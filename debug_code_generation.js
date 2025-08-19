const { GenerateLuaProcessCommand } = await import('./dist/tools/process/commands/GenerateLuaProcessCommand.js');

try {
  console.log('🔍 Examining generated code to find parameter B issue...');
  const command = new GenerateLuaProcessCommand();
  const result = await command.execute({
    userRequest: 'Create a calculator with add and subtract operations',
    includeExplanation: false
  });
  const parsed = JSON.parse(result);
  const code = parsed.workflow.code.generatedCode;
  
  console.log('\n=== SEARCHING FOR PARAMETER B IN LUA CODE ===');
  const addHandlerMatch = code.match(/Handlers\.add\(\s*[""'']addition[""''].*?function\(msg\)([\s\S]*?)end\s*\)/);
  if (addHandlerMatch) {
    const addBody = addHandlerMatch[1];
    console.log('Add handler body (first 300 chars):');
    console.log(addBody.substring(0, 300));
    console.log('Contains msg.Tags.B:', addBody.includes('msg.Tags.B'));
    console.log('Contains msg.Tags.b:', addBody.includes('msg.Tags.b'));
  }
  
  const subtractHandlerMatch = code.match(/Handlers\.add\(\s*[""'']subtraction[""''].*?function\(msg\)([\s\S]*?)end\s*\)/);
  if (subtractHandlerMatch) {
    const subtractBody = subtractHandlerMatch[1];
    console.log('\nSubtract handler body (first 300 chars):');
    console.log(subtractBody.substring(0, 300));
    console.log('Contains msg.Tags.B:', subtractBody.includes('msg.Tags.B'));
    console.log('Contains msg.Tags.b:', subtractBody.includes('msg.Tags.b'));
  }
  
  console.log('\n=== SEARCHING FOR PARAMETER B IN ADP METADATA ===');
  // Find Add handler metadata
  const addMetadataMatch = code.match(/\{[\s\S]*?action\s*=\s*[""'']Add[""''][\s\S]*?\}/);
  if (addMetadataMatch) {
    console.log('Add handler metadata:');
    console.log(addMetadataMatch[0]);
    console.log('Contains parameter B:', addMetadataMatch[0].includes('name = "B"'));
  }
  
  // Find Subtract handler metadata  
  const subtractMetadataMatch = code.match(/\{[\s\S]*?action\s*=\s*[""'']Subtract[""''][\s\S]*?\}/);
  if (subtractMetadataMatch) {
    console.log('\nSubtract handler metadata:');
    console.log(subtractMetadataMatch[0]);
    console.log('Contains parameter B:', subtractMetadataMatch[0].includes('name = "B"'));
  }
  
  console.log('\n=== FULL HANDLERS METADATA SECTION ===');
  const handlersStart = code.indexOf('handlers = {');
  if (handlersStart !== -1) {
    let braceCount = 0;
    let i = handlersStart + 'handlers = '.length;
    let foundStart = false;
    let endPosition = -1;
    
    while (i < code.length) {
      const char = code[i];
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          endPosition = i + 1;
          break;
        }
      }
      i++;
    }
    
    if (endPosition !== -1) {
      const handlersText = code.substring(handlersStart, endPosition);
      console.log(handlersText);
    }
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}