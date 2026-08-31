export function demonstrateVarHoisting() {
  try {
    const output = [];
    output.push(`Value before declaration: ${a}`);
    var a = 10;
    output.push(`Value after declaration: ${a}`);
    return { success: true, log: output };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

export function demonstrateLetHoisting() {
  try {
    const output = [];
    const readBeforeInit = () => b;
    readBeforeInit();
    let b = 20;
    return { success: true, log: output };
  } catch (err) {
    return {
      success: false,
      errorName: err.name,
      errorMessage: err.message,
      explanation: "let is hoisted to the block scope but remains uninitialized in the Temporal Dead Zone (TDZ) until execution reaches its declaration line."
    };
  }
}

export function demonstrateConstHoisting() {
  try {
    const output = [];
    const readBeforeInit = () => c;
    readBeforeInit();
    const c = 30;
    return { success: true, log: output };
  } catch (err) {
    return {
      success: false,
      errorName: err.name,
      errorMessage: err.message,
      explanation: "const is hoisted into the TDZ uninitialized. Accessing it prior to initialization throws ReferenceError, and const requires an immediate initializer."
    };
  }
}

export function demonstrateBlockScopeShadowing() {
  const x = "outer const";
  let y = "outer let";
  const results = [];

  results.push(`Before block: x="${x}", y="${y}"`);
  {
    const x = "inner block const";
    let y = "inner block let";
    results.push(`Inside block: x="${x}", y="${y}"`);
  }
  results.push(`After block: x="${x}", y="${y}"`);

  return results;
}

export function demonstrateFunctionHoistingVsConst() {
  const results = [];
  
  results.push(`Function declaration call before def: ${declaredFunction()}`);
  function declaredFunction() {
    return "declaredFunction hoisted completely";
  }

  try {
    arrowFunction();
    const arrowFunction = () => "arrowFunction with const";
  } catch (err) {
    results.push(`Arrow function via const before def: ${err.name} - ${err.message}`);
  }

  return results;
}
