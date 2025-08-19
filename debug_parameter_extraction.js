const { ParameterExtractionService } = await import('./dist/services/ParameterExtractionService.js');
const { GenerateLuaProcessCommand } = await import('./dist/tools/process/commands/GenerateLuaProcessCommand.js');

try {
  console.log('🔍 Testing parameter extraction services step by step...');
  
  const command = new GenerateLuaProcessCommand();
  const result = await command.execute({
    userRequest: 'Create a calculator with add and subtract operations',
    includeExplanation: false
  });
  const parsed = JSON.parse(result);
  const code = parsed.workflow.code.generatedCode;
  
  console.log('\n=== STEP 1: Parameter extraction from Lua code ===');
  const paramExtractor = new ParameterExtractionService();
  const extractedParameters = paramExtractor.extractParametersFromCode(code);
  
  console.log('Extracted parameters from Lua code:');
  for (const [actionName, params] of extractedParameters.entries()) {
    console.log(`  Action: ${actionName}`);
    console.log(`    Parameters: ${params.map(p => p.name).join(', ')}`);
  }
  
  console.log('\n=== STEP 2: Parameter extraction from ADP metadata ===');
  // Simulate the same logic used in validateParameterCrossReference
  
  const declaredParameters = new Map();
  
  // Extract the complete handlers section
  const handlersStart = code.indexOf('handlers = {');
  let handlersJsonMatch = null;
  
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
      handlersJsonMatch = [handlersText];
    }
  }
  
  if (handlersJsonMatch) {
    const handlersText = handlersJsonMatch[0];
    console.log('Handlers text extracted (length:', handlersText.length, ')');
    
    // Parse handlers just like in validateParameterCrossReference
    const innerHandlersContent = handlersText
      .replace(/^handlers\s*=\s*\{\s*/, '')
      .replace(/\s*\}\s*$/, '');
      
    console.log('Inner handlers content (first 500 chars):');
    console.log(innerHandlersContent.substring(0, 500) + '...');
    
    const handlerObjects = [];
    
    // Find each handler block
    let currentPos = 0;
    let iteration = 0;
    while (currentPos < innerHandlersContent.length && iteration < 10) {
      iteration++;
      console.log(`\n--- Handler parsing iteration ${iteration}, position ${currentPos} ---`);
      
      const openBracePos = innerHandlersContent.indexOf('{', currentPos);
      if (openBracePos === -1) {
        console.log('No more opening braces found');
        break;
      }
      
      console.log('Found opening brace at position', openBracePos);
      
      // Count braces to find matching closing brace
      let braceCount = 1;
      let closeBracePos = openBracePos + 1;
      
      while (closeBracePos < innerHandlersContent.length && braceCount > 0) {
        if (innerHandlersContent[closeBracePos] === '{') {
          braceCount++;
        } else if (innerHandlersContent[closeBracePos] === '}') {
          braceCount--;
        }
        closeBracePos++;
      }
      
      console.log(`Closing brace at position ${closeBracePos - 1}, final brace count: ${braceCount}`);
      
      if (braceCount === 0) {
        const handlerText = innerHandlersContent.substring(openBracePos, closeBracePos);
        console.log(`Handler text (first 200 chars): ${handlerText.substring(0, 200)}...`);
        
        // Check if this contains an action
        const actionMatch = handlerText.match(/action\s*=\s*["']([^"']+)["']/);
        if (actionMatch) {
          console.log(`✅ Found action: ${actionMatch[1]}`);
          
          // Look for parameters in this handler
          const parameterBlockMatch = handlerText.match(/parameters\s*=\s*\{([\s\S]*?)\}/);
          if (parameterBlockMatch) {
            console.log('✅ Found parameters block');
            const parameterBlock = parameterBlockMatch[1];
            const paramMatches = [...parameterBlock.matchAll(/name\s*=\s*["']([^"']+)["']/g)];
            const paramNames = paramMatches.map(m => m[1]);
            console.log(`   Parameters: ${paramNames.join(', ')}`);
            
            declaredParameters.set(actionMatch[1], new Set(paramNames));
          } else {
            console.log('❌ No parameters block found');
            declaredParameters.set(actionMatch[1], new Set());
          }
          
          handlerObjects.push({
            action: actionMatch[1],
            text: handlerText
          });
        } else {
          console.log('❌ No action found in this block');
        }
        
        currentPos = closeBracePos;
      } else {
        console.log('❌ Unmatched braces, moving to next position');
        currentPos = openBracePos + 1;
      }
    }
    
    console.log('\n=== STEP 3: Compare extracted vs declared parameters ===');
    console.log('Declared parameters from ADP metadata:');
    for (const [actionName, params] of declaredParameters.entries()) {
      console.log(`  Action: ${actionName}`);
      console.log(`    Parameters: ${Array.from(params).join(', ')}`);
    }
    
    console.log('\n=== STEP 4: Cross-reference validation ===');
    let totalChecks = 0;
    let passedChecks = 0;
    
    // Check for undeclared used parameters (the failing case)
    for (const [actionName, usedParams] of extractedParameters.entries()) {
      const declaredParams = declaredParameters.get(actionName) || new Set();
      
      console.log(`\nChecking action: ${actionName}`);
      console.log(`  Used params: ${usedParams.map(p => p.name).join(', ')}`);
      console.log(`  Declared params: ${Array.from(declaredParams).join(', ')}`);
      
      for (const usedParam of usedParams) {
        totalChecks++;
        if (declaredParams.has(usedParam.name)) {
          passedChecks++;
          console.log(`  ✅ Parameter '${usedParam.name}' found in both`);
        } else {
          console.log(`  ❌ Parameter '${usedParam.name}' used but not declared`);
        }
      }
    }
    
    const crossReferenceScore = totalChecks > 0 ? passedChecks / totalChecks : 1;
    console.log(`\nFinal cross-reference score: ${(crossReferenceScore * 100).toFixed(1)}%`);
    console.log(`Passed checks: ${passedChecks} / ${totalChecks}`);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}