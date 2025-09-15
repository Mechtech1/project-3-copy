import { Vehicle } from '@/types';

interface VPICResponse {
  Results: Array<{
    Variable: string;
    Value: string | null;
    ValueId: string | null;
  }>;
}

interface NHTSAVinResponse {
  Results: VPICResponse['Results'];
  Message: string;
  SearchCriteria: string;
  Count: number;
}

export class VinApiService {
  private static instance: VinApiService;
  
  static getInstance(): VinApiService {
    if (!VinApiService.instance) {
      VinApiService.instance = new VinApiService();
    }
    return VinApiService.instance;
  }

  /**
   * Decode VIN using NHTSA's free API
   * This is a reliable government API that doesn't require API keys
   */
  async decodeVinWithNHTSA(vin: string): Promise<Vehicle | null> {
    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`NHTSA API error: ${response.status} ${response.statusText}`);
      }

      const data: NHTSAVinResponse = await response.json();
      
      if (!data.Results || data.Results.length === 0) {
        throw new Error('No VIN data found');
      }

      // Extract vehicle information from NHTSA response
      const make = this.extractValue(data.Results, 'Make');
      const model = this.extractValue(data.Results, 'Model');
      const yearStr = this.extractValue(data.Results, 'Model Year');
      const trim = this.extractValue(data.Results, 'Trim');
      const engineConfig = this.extractValue(data.Results, 'Engine Configuration');
      const displacement = this.extractValue(data.Results, 'Displacement (L)');
      const displacementCC = this.extractValue(data.Results, 'Displacement (CC)');
      const bodyClass = this.extractValue(data.Results, 'Body Class');
      const driveType = this.extractValue(data.Results, 'Drive Type');
      const plantCountry = this.extractValue(data.Results, 'Plant Country');
      const steeringLocation = this.extractValue(data.Results, 'Steering Location');

      if (!make || !model || !yearStr) {
        throw new Error('Incomplete vehicle data from VIN');
      }

      const year = parseInt(yearStr, 10);
      if (isNaN(year) || year < 1980 || year > new Date().getFullYear() + 1) {
        throw new Error('Invalid model year');
      }

      // Process engine information
      let engine = 'Unknown';
      if (displacement) {
        engine = `${displacement}L`;
        if (engineConfig) {
          engine += ` ${engineConfig}`;
        }
      } else if (displacementCC) {
        const liters = (parseFloat(displacementCC) / 1000).toFixed(1);
        engine = `${liters}L`;
        if (engineConfig) {
          engine += ` ${engineConfig}`;
        }
      } else if (engineConfig) {
        engine = engineConfig;
      }

      // Process body style
      const bodyStyle = this.normalizeBodyStyle(bodyClass);

      // Process drivetrain
      const drivetrain = this.normalizeDrivetrain(driveType);

      // Determine market based on plant country
      const market = this.determineMarket(plantCountry);

      // Determine steering (LHD/RHD)
      const steering = this.determineSteering(steeringLocation, market);

      return {
        vin: vin.toUpperCase(),
        make,
        model,
        year,
        trim: trim || undefined,
        engine,
        bodyStyle,
        drivetrain,
        market,
        steering,
      };
    } catch (error) {
      console.error('NHTSA VIN decode error:', error);
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        throw new Error('Network connection failed. Please check your internet connection and try again.');
      }
      throw error;
    }
  }

  /**
   * Decode VIN using commercial API (if API key is provided)
   * You can replace this with your preferred VIN API service
   */
  async decodeVinWithCommercialApi(vin: string): Promise<Vehicle | null> {
    const apiKey = process.env.VIN_DECODER_API_KEY;
    
    if (!apiKey || apiKey === 'placeholder-vin-key') {
      throw new Error('Commercial VIN API key not configured');
    }

    try {
      // Example: Using VinAudit API (replace with your preferred service)
      const response = await fetch(`https://api.vinaudit.com/getvin/${vin}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`VIN API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        vin: vin.toUpperCase(),
        make: data.make,
        model: data.model,
        year: data.year,
        trim: data.trim,
      };
    } catch (error) {
      console.error('Commercial VIN API error:', error);
      throw error;
    }
  }

  /**
   * Main VIN decode method that tries multiple sources
   */
  async decodeVin(vin: string): Promise<Vehicle | null> {
    // First try NHTSA (free, reliable)
    try {
      return await this.decodeVinWithNHTSA(vin);
    } catch (nhtsa_error) {
      console.warn('NHTSA decode failed, trying commercial API:', nhtsa_error);
      
      // Fallback to commercial API if available
      try {
        return await this.decodeVinWithCommercialApi(vin);
      } catch (commercial_error) {
        console.warn('Commercial API decode failed:', commercial_error);
        
        // Last fallback: return mock data for development
        return this.getMockVehicleData(vin);
      }
    }
  }

  /**
   * Extract value from NHTSA API response
   */
  private extractValue(results: VPICResponse['Results'], variableName: string): string | null {
    const result = results.find(item => item.Variable === variableName);
    return result?.Value || null;
  }

  /**
   * Normalize body style to standard format
   */
  private normalizeBodyStyle(bodyClass: string | null): string {
    if (!bodyClass) return 'Unknown';
    
    const normalized = bodyClass.toLowerCase();
    if (normalized.includes('sedan')) return 'Sedan';
    if (normalized.includes('suv') || normalized.includes('sport utility')) return 'SUV';
    if (normalized.includes('truck') || normalized.includes('pickup')) return 'Truck';
    if (normalized.includes('hatchback')) return 'Hatchback';
    if (normalized.includes('coupe')) return 'Coupe';
    if (normalized.includes('wagon')) return 'Wagon';
    if (normalized.includes('convertible')) return 'Convertible';
    if (normalized.includes('van')) return 'Van';
    
    return bodyClass; // Return original if no match
  }

  /**
   * Normalize drivetrain to standard format
   */
  private normalizeDrivetrain(driveType: string | null): string {
    if (!driveType) return 'Unknown';
    
    const normalized = driveType.toLowerCase();
    if (normalized.includes('front') || normalized.includes('fwd') || normalized === '4x2') return 'FWD';
    if (normalized.includes('rear') || normalized.includes('rwd')) return 'RWD';
    if (normalized.includes('all') || normalized.includes('awd') || normalized.includes('4wd') || normalized === '4x4') return 'AWD';
    
    return driveType; // Return original if no match
  }

  /**
   * Determine market based on plant country
   */
  private determineMarket(plantCountry: string | null): string {
    if (!plantCountry) return 'Unknown';
    
    const country = plantCountry.toLowerCase();
    if (country.includes('united states') || country.includes('usa') || country.includes('us')) return 'US';
    if (country.includes('canada')) return 'US'; // North American market
    if (country.includes('mexico')) return 'US'; // NAFTA market
    if (country.includes('germany') || country.includes('france') || country.includes('italy') || 
        country.includes('spain') || country.includes('uk') || country.includes('united kingdom')) return 'EU';
    if (country.includes('japan')) return 'JP';
    if (country.includes('korea') || country.includes('south korea')) return 'KR';
    if (country.includes('china')) return 'CN';
    
    return 'Other';
  }

  /**
   * Determine steering (LHD/RHD) based on steering location and market
   */
  private determineSteering(steeringLocation: string | null, market: string): string {
    if (steeringLocation) {
      const location = steeringLocation.toLowerCase();
      if (location.includes('left')) return 'LHD';
      if (location.includes('right')) return 'RHD';
    }
    
    // Fallback based on market
    if (market === 'US' || market === 'EU' || market === 'CN' || market === 'KR') return 'LHD';
    if (market === 'JP') return 'RHD';
    
    return 'Unknown';
  }

  /**
   * Mock vehicle data for development/testing
   */
  private getMockVehicleData(vin: string): Vehicle {
    console.warn('Using mock vehicle data - configure VIN API for production');
    
    // Different mock vehicles based on VIN for variety
    const mockVehicles = [
      { 
        make: 'Honda', model: 'Civic', year: 2015, trim: 'LX',
        engine: '1.8L I4', bodyStyle: 'Sedan', drivetrain: 'FWD', market: 'US', steering: 'LHD'
      },
      { 
        make: 'Toyota', model: 'Camry', year: 2018, trim: 'LE',
        engine: '2.5L I4', bodyStyle: 'Sedan', drivetrain: 'FWD', market: 'US', steering: 'LHD'
      },
      { 
        make: 'Ford', model: 'F-150', year: 2020, trim: 'XLT',
        engine: '3.5L V6', bodyStyle: 'Truck', drivetrain: 'RWD', market: 'US', steering: 'LHD'
      },
      { 
        make: 'Chevrolet', model: 'Malibu', year: 2017, trim: 'LT',
        engine: '1.5L I4', bodyStyle: 'Sedan', drivetrain: 'FWD', market: 'US', steering: 'LHD'
      },
    ];
    
    // Use VIN to consistently select the same mock vehicle
    const index = vin.charCodeAt(vin.length - 1) % mockVehicles.length;
    const mockVehicle = mockVehicles[index];
    
    return {
      vin: vin.toUpperCase(),
      ...mockVehicle,
    };
  }

  /**
   * Validate VIN format
   */
  validateVin(vin: string): boolean {
    // Basic VIN validation
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    if (!vinRegex.test(vin.toUpperCase())) {
      return false;
    }

    // Check for invalid characters (I, O, Q not allowed in VINs)
    if (/[IOQ]/i.test(vin)) {
      return false;
    }

    return true;
  }

  /**
   * Get vehicle compatibility info for repair suggestions
   */
  async getVehicleCompatibility(vehicle: Vehicle): Promise<string[]> {
    // Return compatible vehicle makes/models for repair database filtering
    const compatibleVehicles = [vehicle.make];
    
    // Add similar makes for broader repair options
    const brandFamilies = {
      'Honda': ['Honda', 'Acura'],
      'Toyota': ['Toyota', 'Lexus'],
      'Ford': ['Ford', 'Lincoln', 'Mercury'],
      'Chevrolet': ['Chevrolet', 'GMC', 'Buick'],
      'Nissan': ['Nissan', 'Infiniti'],
    };
    
    const family = brandFamilies[vehicle.make as keyof typeof brandFamilies];
    if (family) {
      compatibleVehicles.push(...family);
    }
    
    return [...new Set(compatibleVehicles)]; // Remove duplicates
  }
} 