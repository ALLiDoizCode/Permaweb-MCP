const { GenerateLuaProcessCommand } = await import('./dist/tools/process/commands/GenerateLuaProcessCommand.js');

try {
  console.log('🔍 Testing ADP compliance validation in detail...');
  const command = new GenerateLuaProcessCommand();
  const result = await command.execute({
    userRequest: 'Create a calculator with add and subtract operations',
    includeExplanation: false
  });
  const parsed = JSON.parse(result);
  
  console.log('\n📊 ADP Compliance Results:');
  console.log('Success:', parsed.success);
  console.log('ADP Compliant:', parsed.workflow.adpCompliance.isCompliant ? '✅ YES' : '❌ NO');
  
  console.log('\n📋 Individual Checks:');
  Object.entries(parsed.workflow.adpCompliance.checks).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`   ${status} ${key}`);
  });
  
  console.log('\n📈 Parameter Coverage:');
  const coverage = parsed.workflow.adpCompliance.parameterCoverage;
  console.log('  - Handlers with parameters:', coverage.handlersWithParameters);
  console.log('  - Total handlers:', coverage.totalHandlers);
  if (coverage.totalHandlers > 0) {
    const percentage = (coverage.handlersWithParameters / coverage.totalHandlers * 100).toFixed(1);
    console.log('  - Coverage percentage:', percentage + '%', percentage >= 50 ? '✅' : '❌');
  }
  
  console.log('\n📊 Parameter Validation Scores:');
  const validation = parsed.workflow.adpCompliance.parameterValidation;
  console.log('  - Cross-reference score:', (validation.crossReferenceScore * 100).toFixed(1) + '%', validation.crossReferenceScore > 0.8 ? '✅' : '❌');
  console.log('  - Type validation score:', (validation.typeValidationScore * 100).toFixed(1) + '%', validation.typeValidationScore > 0.7 ? '✅' : '❌');
  console.log('  - Validation rule score:', (validation.validationRuleScore * 100).toFixed(1) + '%', validation.validationRuleScore > 0.6 ? '✅' : '❌');
  
  const totalWarnings = parsed.workflow.adpCompliance.warnings.length;
  console.log('\n⚠️  Warnings (' + totalWarnings + '):');
  if (totalWarnings === 0) {
    console.log('   🎉 No warnings!');
  } else {
    parsed.workflow.adpCompliance.warnings.slice(0, 5).forEach(warning => {
      console.log('   -', warning);
    });
    if (totalWarnings > 5) {
      console.log('   ... and', totalWarnings - 5, 'more warnings');
    }
  }
  
  console.log('\n🎯 SPECIFIC ISSUES TO FIX:');
  const failing = Object.entries(parsed.workflow.adpCompliance.checks).filter(([k,v]) => !v);
  if (failing.length > 0) {
    console.log('❌ Failing checks:', failing.map(([k]) => k).join(', '));
  } else {
    console.log('✅ All checks passing!');
  }
  
  if (validation.crossReferenceScore <= 0.8) {
    console.log('❌ Cross-reference score too low:', (validation.crossReferenceScore * 100).toFixed(1) + '%');
  }
  
  if (validation.typeValidationScore <= 0.7) {
    console.log('❌ Type validation score too low:', (validation.typeValidationScore * 100).toFixed(1) + '%');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}