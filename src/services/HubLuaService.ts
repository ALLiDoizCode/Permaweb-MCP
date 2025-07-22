export const luaModule = `
local json = require('json')
local bint = require('.bint')(256)
local utils = require(".utils")

Kinds = {
    PROFILE_UPDATE = "0",
    NOTE = "1",
    FOLLOW = "3",
    REACTION = "7"
}

State = {
    Events = Events or {},
    Owner = Owner,
    Spec = {
        type = "hub",
        description = "Social message hub",
        version = "0.1",
        processId = ao.id
    }
}

local function slice(tbl, start_idx, end_idx)
    local new_table = {}
    table.move(tbl, start_idx or 1, end_idx or #tbl, 1, new_table)
    return new_table
end

local function getTag(tags, key)
    for _, tag in ipairs(tags or {}) do
        if tag[1] == key then return tag[2] end
    end
end

local function addUniqueString(array, hashTable, str)
    if not hashTable[str] then
        hashTable[str] = true
        table.insert(array, str)
    end
end

local function getFollowList()
    for i = #State.Events, 1, -1 do
        local e = State.Events[i]
        if e.Kind == Kinds.FOLLOW and e.From == ao.id then
            return json.decode(e.p)
        end
    end
    return {}
end

local function getFollowers()
    local followers = {}
    local followers_hash = {}
    for i = #State.Events, 1, -1 do
        local e = State.Events[i]
        if e.Kind == Kinds.FOLLOW and e.From ~= ao.id then
            addUniqueString(followers, followers_hash, e.From)
        end
    end
    return followers
end

local function arrayDiff(arr1, arr2)
    -- Create a set from arr2 for O(1) lookup
    local set2 = {}
    for _, v in ipairs(arr2) do
        set2[v] = true
    end

    -- Create result array with elements from arr1 not in set2
    local result = {}
    for _, v in ipairs(arr1) do
        if not set2[v] then
            table.insert(result, v)
        end
    end

    return result
end

local function broadcastToFollowers(msg)
    for _, f in ipairs(getFollowers()) do
        ao.send({ Target = f, Action = "Event", Data = msg.Data, Tags = msg.Tags })
    end
end

local function filter(filter, events)
    local _events = events

    if filter.ids then
        _events = utils.filter(function(e) return utils.includes(e.Id, filter.ids) end, _events)
    end

    if filter.authors then
        _events = utils.filter(function(e) return utils.includes(e.From, filter.authors) end, _events)
    end

    if filter.kinds then
        _events = utils.filter(function(e) return utils.includes(e.Kind, filter.kinds) end, _events)
    end

    if filter.since then
        _events = utils.filter(function(e) return e.Timestamp > filter.since end, _events)
    end

    if filter["until"] then
        _events = utils.filter(function(e) return e.Timestamp < filter["until"] end, _events)
    end

    if filter.tags then
        for key, tags in pairs(filter.tags) do
            _events = utils.filter(function(e)
                if e[key] then
                    return utils.includes(json.encode(e[key]), tags)
                end
                return false
            end, events)
        end
    end

    if filter.search then
        _events = utils.filter(function(e)
            if string.find(string.lower(json.encode(e)), string.lower(filter.search)) then
                return true
            end
            return false
        end, _events)
    end

    table.sort(_events, function(a, b) return a.Timestamp > b.Timestamp end)

    local limit = math.min(filter.limit or 50, 500)
    if #_events > limit then
        _events = slice(_events, 1, limit)
    end

    return _events
end

local function fetchEvents(msg)
    local filters = json.decode(msg.Filters or "[]")
    local result = State.Events

    for _, f in ipairs(filters) do
        result = filter(f, result)
    end

    ao.send({
        Target = msg.From,
        Data = json.encode(result)
    })
end

function event(msg)
    local following = getFollowList()
    local isFollowed = utils.includes(msg.From, following)

    if msg.From == State.Owner then
        msg.From = ao.id
        msg.Tags["Original-Id"] = msg.Id
        if msg.Kind == Kinds.FOLLOW and msg.p then
            table.insert(State.Events, msg)
            for _, v in ipairs(json.decode(msg.p)) do
                ao.send({ Target = v, Action = "Event", p = msg.p, Kind = msg.Kind })
            end
            for _, v in ipairs(following) do
                ao.send({ Target = v, Action = "Event", p = msg.p, Kind = msg.Kind })
            end
        elseif msg.Kind == Kinds.REACTION and msg.Content and msg.e and msg.p then
            local _event = utils.find(
                function(event)
                    return msg.From == event.From and msg.Kind == event.Kind and msg.e == event.e and
                        msg.p == event.p
                end,
                State.Events
            )
            if _event then
                State.Events = utils.filter(function(event)
                    return event.Id ~= _event.Id
                end, State.Events)
            else
                table.insert(State.Events, msg)
            end
        else
            table.insert(State.Events, msg)
            broadcastToFollowers(msg)
        end
    elseif msg.Kind == Kinds.FOLLOW then
        local isFollowingMe = utils.includes(ao.id, json.decode(msg.p))
        if isFollowingMe == false then
            State.Events = utils.filter(function(e)
                if e.Kind == Kinds.FOLLOW and e.From == msg.From then
                    return false
                else
                    return true
                end
            end, State.Events)
        else
            table.insert(State.Events, msg)
        end
    elseif msg.Kind == Kinds.REACTION and msg.Content and msg.e and msg.p then
        local _event = utils.find(
            function(event)
                return msg.From == event.From and msg.Kind == event.Kind and msg.e == event.e and
                    msg.p == event.p
            end,
            State.Events
        )
        if _event then
            State.Events = utils.filter(function(event)
                return event.Id ~= _event.Id
            end, State.Events)
        else
            table.insert(State.Events, msg)
        end
    elseif msg.Kind == Kinds.NOTE and msg.Content and msg.e and msg.p and msg.marker == "reply" then
        local _event = utils.find(
            function(event)
                return msg.From == event.From and msg.Kind == event.Kind and msg.e == event.e and
                    msg.p == event.p
            end,
            State.Events
        )
        if _event then
            State.Events = utils.filter(function(event)
                return event.Id ~= _event.Id
            end, State.Events)
        else
            table.insert(State.Events, msg)
        end
    elseif isFollowed then
        table.insert(State.Events, msg)
    end
end

Handlers.add('Event', Handlers.utils.hasMatchingTag('Action', 'Event'), event)

Handlers.add('FetchEvents', Handlers.utils.hasMatchingTag('Action', 'FetchEvents'), fetchEvents)

Handlers.add("Info", Handlers.utils.hasMatchingTag("Action", "Info"), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode({
            User = State.Owner,
            Spec = State.Spec,
            FeePolicy = State.FeePolicy,
            AllowedKinds = State.AllowedKinds,
            Followers = getFollowers(),
            Following = getFollowList()
        })
    })
end)
`;
