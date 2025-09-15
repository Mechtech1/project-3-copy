import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Vehicle } from '@/types';
import { decodeVin } from './vinService';

export interface UserVehicle extends Vehicle {
  id: string;
  userId: string;
  createdAt: string;
}

export class VehicleProfileService {
  private static instance: VehicleProfileService;

  static getInstance(): VehicleProfileService {
    if (!VehicleProfileService.instance) {
      VehicleProfileService.instance = new VehicleProfileService();
    }
    return VehicleProfileService.instance;
  }

  /**
   * Get all vehicles for the current user
   */
  async getUserVehicles(): Promise<UserVehicle[]> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, returning mock vehicles');
      return this.getMockVehicles();
    }

    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('User not authenticated, returning empty vehicles list');
        return [];
      }

      const { data: vehicles, error } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user vehicles:', error);
        return [];
      }

      return (vehicles || []).map(vehicle => ({
        id: vehicle.id,
        userId: vehicle.user_id,
        vin: vehicle.vin,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim,
        engine: vehicle.engine,
        bodyStyle: vehicle.body_style,
        drivetrain: vehicle.drivetrain,
        market: vehicle.market,
        steering: vehicle.steering,
        createdAt: vehicle.created_at,
      }));
    } catch (error) {
      console.error('Error in getUserVehicles:', error);
      return [];
    }
  }

  /**
   * Add a new vehicle by VIN
   */
  async addVehicleByVin(vin: string): Promise<UserVehicle | null> {
    try {
      // First decode the VIN to get vehicle details
      const decodedVehicle = await decodeVin(vin);
      if (!decodedVehicle) {
        throw new Error('Unable to decode VIN');
      }

      // Check if vehicle already exists for this user
      const existingVehicles = await this.getUserVehicles();
      const duplicate = existingVehicles.find(v => v.vin === vin.toUpperCase());
      
      if (duplicate) {
        throw new Error('Vehicle already exists in your profile');
      }

      if (!isSupabaseConfigured()) {
        // Return mock vehicle for development
        return {
          id: `mock-${Date.now()}`,
          userId: 'mock-user',
          ...decodedVehicle,
          createdAt: new Date().toISOString(),
        };
      }

      // Get current authenticated user (required now)
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('User authentication failed. Please sign in again.');
      }

      // Save to database
      const { data: savedVehicle, error } = await supabase
        .from('user_vehicles')
        .insert({
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
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving vehicle:', error);
        throw new Error('Failed to save vehicle profile');
      }

      return {
        id: savedVehicle.id,
        userId: savedVehicle.user_id,
        vin: savedVehicle.vin,
        make: savedVehicle.make,
        model: savedVehicle.model,
        year: savedVehicle.year,
        trim: savedVehicle.trim,
        engine: savedVehicle.engine,
        bodyStyle: savedVehicle.body_style,
        drivetrain: savedVehicle.drivetrain,
        market: savedVehicle.market,
        steering: savedVehicle.steering,
        createdAt: savedVehicle.created_at,
      };
    } catch (error) {
      console.error('Error adding vehicle:', error);
      throw error;
    }
  }

  /**
   * Delete a vehicle profile
   */
  async deleteVehicle(vehicleId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, mock delete');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_vehicles')
        .delete()
        .eq('id', vehicleId);

      if (error) {
        console.error('Error deleting vehicle:', error);
        throw new Error('Failed to delete vehicle');
      }
    } catch (error) {
      console.error('Error in deleteVehicle:', error);
      throw error;
    }
  }

  /**
   * Get vehicle by ID
   */
  async getVehicleById(vehicleId: string): Promise<UserVehicle | null> {
    const vehicles = await this.getUserVehicles();
    return vehicles.find(v => v.id === vehicleId) || null;
  }

  /**
   * Mock vehicles for development
   */
  private getMockVehicles(): UserVehicle[] {
    return [
      {
        id: 'mock-1',
        userId: 'mock-user',
        vin: '1HGBH41JXMN109186',
        make: 'Honda',
        model: 'Civic',
        year: 2015,
        trim: 'LX',
        engine: '1.8L I4',
        bodyStyle: 'Sedan',
        drivetrain: 'FWD',
        market: 'US',
        steering: 'LHD',
        createdAt: '2024-01-15T10:30:00Z',
      },
      {
        id: 'mock-2',
        userId: 'mock-user',
        vin: '1FTFW1ET5DFC12345',
        make: 'Ford',
        model: 'F-150',
        year: 2020,
        trim: 'XLT',
        engine: '3.5L V6',
        bodyStyle: 'Truck',
        drivetrain: 'RWD',
        market: 'US',
        steering: 'LHD',
        createdAt: '2024-01-10T14:20:00Z',
      },
    ];
  }
}