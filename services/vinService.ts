import { Vehicle } from '@/types';
import { supabase, isSupabaseConfigured, getSupabaseConfigError } from '@/lib/supabase';
import { VinApiService } from './vinApiService';

const vinApiService = VinApiService.getInstance();

export async function decodeVin(vin: string): Promise<Vehicle | null> {
  if (!validateVin(vin)) {
    throw new Error('Invalid VIN format. VIN must be 17 characters with valid format.');
  }

  try {
    // First check if vehicle already exists in user_vehicles table (with timeout)
    if (isSupabaseConfigured()) {
      try {
        console.log('Checking database for existing vehicle...');
        
        // Get current authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (user && !authError) {
          const dbPromise = supabase
            .from('user_vehicles')
            .select('*')
            .eq('vin', vin.toUpperCase())
            .eq('user_id', user.id)
            .single();

          // Add timeout for database query
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database query timeout')), 3000)
          );

          const { data: existingVehicle, error: fetchError } = await Promise.race([dbPromise, timeoutPromise]) as any;

          if (existingVehicle && !fetchError) {
            console.log('Found existing vehicle in database');
            return {
              vin: existingVehicle.vin,
              make: existingVehicle.make,
              model: existingVehicle.model,
              year: existingVehicle.year,
              trim: existingVehicle.trim || undefined,
              engine: existingVehicle.engine || undefined,
              bodyStyle: existingVehicle.body_style || undefined,
              drivetrain: existingVehicle.drivetrain || undefined,
              market: existingVehicle.market || undefined,
              steering: existingVehicle.steering || undefined,
            };
          }
        }
      } catch (dbError) {
        console.warn('Database lookup failed, proceeding with API decode:', dbError);
        // Continue with API decode if database fails
      }
    }

    // Decode VIN using external API
    console.log('Decoding VIN via API:', vin);
    const decodedVehicle = await vinApiService.decodeVin(vin);
    
    if (!decodedVehicle) {
      throw new Error('Unable to decode VIN');
    }

    console.log('VIN decoded successfully:', decodedVehicle);

    // Save to user_vehicles table if configured and user is authenticated
    if (isSupabaseConfigured()) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (user && !authError) {
          console.log('Saving vehicle to user_vehicles table:', decodedVehicle);
          const { error } = await supabase
            .from('user_vehicles')
            .upsert({
              user_id: user.id,
              vin: decodedVehicle.vin,
              make: decodedVehicle.make,
              model: decodedVehicle.model,
              year: decodedVehicle.year,
              trim: decodedVehicle.trim,
              engine: decodedVehicle.engine,
              body_style: decodedVehicle.bodyStyle,
              drivetrain: decodedVehicle.drivetrain,
              market: decodedVehicle.market,
              steering: decodedVehicle.steering,
            }, {
              onConflict: 'user_id,vin'
            });
          
          if (error) {
            console.error('Failed to save vehicle to database:', error);
            throw new Error(`Failed to save vehicle to database: ${error.message}. Cannot proceed with repair session.`);
          } else {
            console.log('Vehicle successfully saved to user_vehicles table');
          }
        } else {
          console.warn('User not authenticated, skipping database save');
        }
      } catch (dbError) {
        console.error('Database save error:', dbError);
        throw new Error(`Database save error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}. Cannot proceed with repair session.`);
      }
    }

    return decodedVehicle;
  } catch (error) {
    console.error('Error decoding VIN:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to decode VIN. Please try again.');
  }
}

export function validateVin(vin: string): boolean {
  return vinApiService.validateVin(vin);
}