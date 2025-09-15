/**
 * Comprehensive test script for Universal Ghost Overlay System
 * Tests VIN decoding, vehicle classification, overlay generation, and rendering
 */

import { classifyVehicleFamily, determineWorkspaceForRepair } from '../services/vehicleClassificationService';
import { generateOverlayPack } from '../services/overlayGenerationService';
import { generateRepairStepsWithOverlay } from '../services/repairService';
import { validateNormalizedCoordinates, convertPolygonToScreenPoints } from '../utils/coordinateUtils';

// Test VINs for different vehicle types
const TEST_VINS = [
  '1HGCM82633A004352', // 2003 Honda Accord
  '1FTFW1ET5DFC10312', // 2013 Ford F-150
  'WBAFR9C50DD239794', // 2013 BMW 3 Series
  '1G1ZT54806F109149', // 2006 Chevrolet Malibu
  'JM1BL1SF6A1363885'  // 2010 Mazda 3
];

// Test repair scenarios
const TEST_REPAIRS = [
  'battery_replacement',
  'oil_change',
  'brake_pad_replacement',
  'air_filter_replacement',
  'spark_plug_replacement'
];

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

/**
 * Main test runner
 */
export async function runOverlaySystemTests(): Promise<TestResult[]> {
  console.log('🧪 Starting Universal Ghost Overlay System Tests...\n');
  
  const results: TestResult[] = [];
  
  // Test 1: Vehicle Classification
  results.push(await testVehicleClassification());
  
  // Test 2: Workspace Type Determination
  results.push(await testWorkspaceTypeDetermination());
  
  // Test 3: Overlay Generation
  results.push(await testOverlayGeneration());
  
  // Test 4: Coordinate Validation
  results.push(await testCoordinateValidation());
  
  // Test 5: Full Integration Test
  results.push(await testFullIntegration());
  
  // Test 6: Error Handling
  results.push(await testErrorHandling());
  
  // Print summary
  printTestSummary(results);
  
  return results;
}

/**
 * Test vehicle classification with real VINs
 */
async function testVehicleClassification(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Testing Vehicle Classification...');
    
    const testVin = TEST_VINS[0]; // Honda Accord
    
    // This would normally decode VIN first, but we'll simulate
    const vehicleInfo = {
      year: 2003,
      make: 'Honda',
      model: 'Accord'
    };
    
    const classification = await classifyVehicleFamily(
      vehicleInfo.year,
      vehicleInfo.make,
      vehicleInfo.model
    );
    
    console.log(`✅ Vehicle classified as: ${classification.family}`);
    console.log(`   Platform: ${classification.platform}`);
    console.log(`   Engine Layout: ${classification.engine_layout}`);
    
    return {
      testName: 'Vehicle Classification',
      success: true,
      duration: Date.now() - startTime,
      data: classification
    };
    
  } catch (error) {
    console.error('❌ Vehicle classification failed:', error);
    return {
      testName: 'Vehicle Classification',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test workspace type determination
 */
async function testWorkspaceTypeDetermination(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('\n🎯 Testing Workspace Type Determination...');
    
    const testResults = [];
    
    for (const repairType of TEST_REPAIRS) {
      const workspaceType = determineWorkspaceForRepair(repairType);
      testResults.push({ repairType, workspaceType });
      console.log(`   ${repairType} → ${workspaceType}`);
    }
    
    console.log('✅ All workspace types determined successfully');
    
    return {
      testName: 'Workspace Type Determination',
      success: true,
      duration: Date.now() - startTime,
      data: testResults
    };
    
  } catch (error) {
    console.error('❌ Workspace determination failed:', error);
    return {
      testName: 'Workspace Type Determination',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test overlay generation
 */
async function testOverlayGeneration(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('\n🎨 Testing Overlay Generation...');
    
    const overlayPack = await generateOverlayPack(
      'honda_accord_family',
      'engine_front',
      'battery_replacement'
    );
    
    // Validate overlay pack structure
    if (!overlayPack.workspace_svg) {
      throw new Error('Missing workspace SVG');
    }
    
    if (!overlayPack.parts || Object.keys(overlayPack.parts).length === 0) {
      throw new Error('No parts defined in overlay pack');
    }
    
    // Validate coordinates
    for (const [partName, part] of Object.entries(overlayPack.parts)) {
      if (!validateNormalizedCoordinates(part.polygon)) {
        throw new Error(`Invalid coordinates for part: ${partName}`);
      }
    }
    
    console.log(`✅ Generated overlay pack with ${Object.keys(overlayPack.parts).length} parts`);
    console.log(`   SVG size: ${overlayPack.workspace_svg.length} characters`);
    console.log(`   Baseline dimensions: ${overlayPack.baseline_dimensions.width}x${overlayPack.baseline_dimensions.height}`);
    
    return {
      testName: 'Overlay Generation',
      success: true,
      duration: Date.now() - startTime,
      data: {
        partCount: Object.keys(overlayPack.parts).length,
        svgSize: overlayPack.workspace_svg.length,
        dimensions: overlayPack.baseline_dimensions
      }
    };
    
  } catch (error) {
    console.error('❌ Overlay generation failed:', error);
    return {
      testName: 'Overlay Generation',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test coordinate validation and conversion
 */
async function testCoordinateValidation(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('\n📐 Testing Coordinate Validation...');
    
    // Test valid coordinates
    const validCoords = [
      { x: 0.0, y: 0.0 },
      { x: 0.5, y: 0.5 },
      { x: 1.0, y: 1.0 }
    ];
    
    if (!validateNormalizedCoordinates(validCoords)) {
      throw new Error('Valid coordinates failed validation');
    }
    
    // Test invalid coordinates
    const invalidCoords = [
      { x: -0.1, y: 0.5 },
      { x: 0.5, y: 1.1 }
    ];
    
    if (validateNormalizedCoordinates(invalidCoords)) {
      throw new Error('Invalid coordinates passed validation');
    }
    
    // Test coordinate conversion
    const overlayBounds = {
      left: 0,
      top: 0,
      width: 1000,
      height: 600
    };
    
    const screenPoints = convertPolygonToScreenPoints(validCoords, overlayBounds);
    
    if (screenPoints !== '0,0 500,300 1000,600') {
      throw new Error('Coordinate conversion failed');
    }
    
    console.log('✅ Coordinate validation and conversion working correctly');
    
    return {
      testName: 'Coordinate Validation',
      success: true,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('❌ Coordinate validation failed:', error);
    return {
      testName: 'Coordinate Validation',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test full integration workflow
 */
async function testFullIntegration(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('\n🔄 Testing Full Integration Workflow...');
    
    const request = {
      vin: TEST_VINS[0],
      repair_type: 'battery_replacement',
      symptoms: 'Car won\'t start, battery seems dead',
      user_experience: 'beginner'
    };
    
    const { repairTask, overlayPack } = await generateRepairStepsWithOverlay(request);
    
    if (!repairTask || !overlayPack) {
      throw new Error('Failed to generate repair task or overlay pack');
    }
    
    if (repairTask.steps.length === 0) {
      throw new Error('No repair steps generated');
    }
    
    if (Object.keys(overlayPack.parts).length === 0) {
      throw new Error('No overlay parts generated');
    }
    
    console.log(`✅ Full integration successful:`);
    console.log(`   Repair steps: ${repairTask.steps.length}`);
    console.log(`   Overlay parts: ${Object.keys(overlayPack.parts).length}`);
    console.log(`   Vehicle family: ${overlayPack.vehicle_family}`);
    console.log(`   Workspace type: ${overlayPack.workspace_type}`);
    
    return {
      testName: 'Full Integration',
      success: true,
      duration: Date.now() - startTime,
      data: {
        stepCount: repairTask.steps.length,
        partCount: Object.keys(overlayPack.parts).length,
        vehicleFamily: overlayPack.vehicle_family,
        workspaceType: overlayPack.workspace_type
      }
    };
    
  } catch (error) {
    console.error('❌ Full integration failed:', error);
    return {
      testName: 'Full Integration',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test error handling and fallbacks
 */
async function testErrorHandling(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('\n🛡️ Testing Error Handling...');
    
    // Test with invalid VIN
    const invalidRequest = {
      vin: 'INVALID_VIN_123',
      repair_type: 'battery_replacement',
      symptoms: 'Test symptoms',
      user_experience: 'beginner'
    };
    
    const { repairTask, overlayPack } = await generateRepairStepsWithOverlay(invalidRequest);
    
    // Should still work with fallback
    if (!repairTask || !overlayPack) {
      throw new Error('Fallback system failed');
    }
    
    // Check if fallback overlay was used
    if (overlayPack.id.startsWith('fallback_')) {
      console.log('✅ Fallback overlay system working correctly');
    } else {
      console.log('✅ System handled invalid VIN gracefully');
    }
    
    return {
      testName: 'Error Handling',
      success: true,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    return {
      testName: 'Error Handling',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Print test summary
 */
function printTestSummary(results: TestResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log('');
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    console.log(`${status} ${result.testName.padEnd(30)} ${duration.padStart(8)}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('');
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Universal Ghost Overlay System is ready for production.');
  } else {
    console.log(`⚠️  ${total - passed} test(s) failed. Please review and fix issues before deployment.`);
  }
}

// Export for use in other test files
export {
  TEST_VINS,
  TEST_REPAIRS,
  TestResult
};
