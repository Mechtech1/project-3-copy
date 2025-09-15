import { generateOverlayPack } from '../services/overlayGenerationService';

/**
 * Test script to verify GPT-4 SVG generation with the fixed prompt
 */
async function testSVGGeneration() {
  console.log('🧪 Testing GPT-4 SVG generation with fixed prompt...');
  
  try {
    // Test with a common vehicle and workspace type
    const testVehicle = {
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      engine: '2.5L I4'
    };
    
    const workspaceType = 'engine';
    
    console.log(`📋 Testing: ${testVehicle.year} ${testVehicle.make} ${testVehicle.model} - ${workspaceType} workspace`);
    
    const result = await generateOverlayPack(testVehicle, workspaceType);
    
    if (result && result.svgContent) {
      console.log('✅ SVG generation successful!');
      console.log(`📏 SVG length: ${result.svgContent.length} characters`);
      
      // Basic SVG validation
      if (result.svgContent.includes('<svg') && result.svgContent.includes('</svg>')) {
        console.log('✅ SVG structure valid (contains opening and closing tags)');
      } else {
        console.log('❌ SVG structure invalid (missing tags)');
      }
      
      // Check for required attributes
      if (result.svgContent.includes('viewBox="0 0 1000 600"')) {
        console.log('✅ ViewBox correct');
      } else {
        console.log('❌ ViewBox missing or incorrect');
      }
      
      // Check for high contrast colors
      if (result.svgContent.includes('#00FFFF') || result.svgContent.includes('#FFFFFF')) {
        console.log('✅ High contrast colors present');
      } else {
        console.log('⚠️ High contrast colors may be missing');
      }
      
      console.log('\n📄 Generated SVG (first 500 chars):');
      console.log(result.svgContent.substring(0, 500) + '...');
      
    } else {
      console.log('❌ No SVG content generated');
    }
    
  } catch (error) {
    console.error('❌ SVG generation failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        console.log('⚠️ Rate limit hit - this confirms API is working but needs retry logic');
      } else if (error.message.includes('API key')) {
        console.log('⚠️ API key issue - check environment variables');
      } else {
        console.log('⚠️ Other error:', error.message);
      }
    }
  }
}

// Run the test
testSVGGeneration().then(() => {
  console.log('🏁 Test completed');
}).catch((error) => {
  console.error('💥 Test script error:', error);
});
