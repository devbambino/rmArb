// app/api/leads/route.ts
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type NextRequest, NextResponse } from 'next/server';

// Schemas for validation using Zod
const merchantSchema = z.object({
  fullname: z.string().min(3, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  city: z.string().min(2, 'City is required'),
  phone: z.string().min(8, 'A phone number 8 digits or larger is required'),
  website: z.string().optional().nullable(),
  revenue: z.string(), // Kept as string for simplicity, converted to number later
  ticket: z.string(),   // Kept as string for simplicity, converted to number later
});

const borrowerSchema = z.object({
  fullname: z.string().min(3, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  city: z.string().min(2, 'City is required'),
  website: z.string().optional().nullable(),
  phone: z.string().optional(),
});

const lenderSchema = z.object({
  fullname: z.string().min(3, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  city: z.string().min(2, 'City is required'),
  website: z.string().optional().nullable(),
  phone: z.string().optional(),
  wallet_address: z.string().optional(),
  deposit_size: z.string().optional(),
});

// Create a Supabase client for server-side operations
// Note: We use the SERVICE_ROLE_KEY here for admin-level access.
// This key should NEVER be exposed on the client side.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { leadType, website, ...data } = await req.json();

    if (website) {
      return NextResponse.json({ message: 'Thanks for sharing your info!' }, { status: 201 });
    }

    let validation;
    let tableName;
    let dataToInsert: any; // To hold potentially transformed data

    // Determine which schema and table to use
    switch (leadType) {
      case 'merchant':
        validation = merchantSchema.safeParse(data);
        tableName = 'merchants';
        if (validation.success) {
          dataToInsert = {
            ...validation.data,
            revenue: parseFloat(validation.data.revenue), // Convert to number
            ticket: parseFloat(validation.data.ticket),   // Convert to number
            phone: validation.data.phone, // ensure phone is string if db expects string like type
          };
        }
        break;
      case 'borrower':
        validation = borrowerSchema.safeParse(data);
        tableName = 'borrowers';
        if (validation.success) {
          dataToInsert = validation.data;
        }
        break;
      case 'lender':
        validation = lenderSchema.safeParse(data);
        tableName = 'lenders';
        if (validation.success) {
          dataToInsert = {
            ...validation.data,
            deposit_size: validation.data.deposit_size ? parseFloat(validation.data.deposit_size) : null, // Convert to number or null
          };
        }
        break;
      default:
        return NextResponse.json({ error: 'Invalid lead type' }, { status: 400 });
    }

    if (!validation || !validation.success) { // Check validation exists before accessing success
      const errorMessages = validation ? validation.error.issues.map(issue => issue.message).join(', ') : 'Unknown validation error';
      return NextResponse.json({ error: 'Invalid form data:', details: errorMessages }, { status: 400 });
    }

    // Insert the validated and potentially transformed data
    const { error } = await supabase.from(tableName!).insert([dataToInsert]); // Use tableName! as it's assigned in switch
    if (error) {
      //console.error('Supabase error:', error);
      // Check for specific Supabase errors if needed, e.g., unique constraint violation
      if (error.code === '23505') { // Postgres unique violation
         return NextResponse.json({ error: 'This email or phone number might already be registered.' , details: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: 'Could not save lead. Please try again.', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Lead successfully registered!' }, { status: 201 });

  } catch (error) {
    //console.error('Server error:', error);
    let errorMessage = 'An unexpected error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}