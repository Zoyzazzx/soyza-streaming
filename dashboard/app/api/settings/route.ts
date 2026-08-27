import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const envPath = path.join(process.cwd(), '..', 'monitor', '.env');
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ error: 'monitor/.env not found' }, { status: 404 });
    }

    const envData = fs.readFileSync(envPath, 'utf8');
    const lines = envData.split('\n');
    let primary = '';
    let backup = '';

    for (const line of lines) {
      if (line.startsWith('PRIMARY_INTERFACE=')) {
        primary = line.split('=')[1].trim();
      } else if (line.startsWith('BACKUP_INTERFACE=')) {
        backup = line.split('=')[1].trim();
      }
    }

    return NextResponse.json({ primary, backup });
  } catch (error) {
    console.error('Error reading env:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { primary, backup } = body;
    
    if (!primary || !backup) {
      return NextResponse.json({ error: 'Missing primary or backup values' }, { status: 400 });
    }

    const envPath = path.join(process.cwd(), '..', 'monitor', '.env');
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ error: 'monitor/.env not found' }, { status: 404 });
    }

    let envData = fs.readFileSync(envPath, 'utf8');
    
    // Replace the primary and backup interfaces
    envData = envData.replace(/^PRIMARY_INTERFACE=.*$/m, `PRIMARY_INTERFACE=${primary}`);
    envData = envData.replace(/^BACKUP_INTERFACE=.*$/m, `BACKUP_INTERFACE=${backup}`);
    
    // As a bonus, we will update the labels if the user types in standard things like Ethernet/WiFi,
    // otherwise we just set the label to the interface name.
    const primaryLabel = primary === 'Ethernet' ? '5G Ethernet' : primary === 'Wi-Fi' ? '4G WiFi' : primary;
    const backupLabel = backup === 'Ethernet' ? '5G Ethernet' : backup === 'Wi-Fi' ? '4G WiFi' : backup;
    
    envData = envData.replace(/^PRIMARY_LABEL=.*$/m, `PRIMARY_LABEL=${primaryLabel}`);
    envData = envData.replace(/^BACKUP_LABEL=.*$/m, `BACKUP_LABEL=${backupLabel}`);

    fs.writeFileSync(envPath, envData, 'utf8');

    return NextResponse.json({ success: true, primary, backup });
  } catch (error) {
    console.error('Error updating env:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
