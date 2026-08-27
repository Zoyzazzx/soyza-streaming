import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function GET() {
  try {
    const envPath = path.join(process.cwd(), '..', 'monitor', '.env');
    let envConfig: any = {};
    if (fs.existsSync(envPath)) {
      const envData = fs.readFileSync(envPath, 'utf8');
      const lines = envData.split('\n');
      for (const line of lines) {
        if (line.includes('=')) {
          const [key, ...rest] = line.split('=');
          envConfig[key.trim()] = rest.join('=').trim();
        }
      }
    }

    const mode = envConfig['FAILOVER_MODE'] || 'interface';
    const primary = envConfig['PRIMARY_TARGET'] || envConfig['PRIMARY_INTERFACE'] || '';
    const backup = envConfig['BACKUP_TARGET'] || envConfig['BACKUP_INTERFACE'] || '';

    // Fetch All Adapters (so even disconnected ones can be selected as backup)
    const { stdout: adaptersOut } = await execAsync(`powershell -Command "@(Get-NetAdapter | Select-Object Name, Status, InterfaceDescription) | ConvertTo-Json -Compress"`);
    const adapters = adaptersOut.trim() ? JSON.parse(adaptersOut) : [];

    // Fetch Default Gateways
    const { stdout: routesOut } = await execAsync(`powershell -Command "@(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object NextHop, InterfaceAlias) | ConvertTo-Json -Compress"`);
    const gateways = routesOut.trim() ? JSON.parse(routesOut) : [];

    const primaryLabel = envConfig['PRIMARY_LABEL'] || '';
    const backupLabel = envConfig['BACKUP_LABEL'] || '';

    // Remove duplicates from gateways just in case, though they are usually unique NextHops
    const uniqueGateways = Array.from(new Map(gateways.map((g: any) => [g.NextHop, g])).values());

    return NextResponse.json({
      mode,
      primary,
      backup,
      primaryLabel,
      backupLabel,
      adapters,
      gateways: uniqueGateways
    });
  } catch (error) {
    console.error('Error fetching settings/network data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode, primary, backup, reset } = body; // mode: 'interface' | 'gateway'
    
    const envPath = path.join(process.cwd(), '..', 'monitor', '.env');
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ error: 'monitor/.env not found' }, { status: 404 });
    }

    let envData = fs.readFileSync(envPath, 'utf8');
    
    const setOrReplaceEnv = (key: string, value: string) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envData)) {
        envData = envData.replace(regex, `${key}=${value}`);
      } else {
        envData += `\n${key}=${value}`;
      }
    };

    if (reset) {
      setOrReplaceEnv('PRIMARY_TARGET', '');
      setOrReplaceEnv('BACKUP_TARGET', '');
      setOrReplaceEnv('PRIMARY_INTERFACE', '');
      setOrReplaceEnv('BACKUP_INTERFACE', '');
      setOrReplaceEnv('PRIMARY_LABEL', '');
      setOrReplaceEnv('BACKUP_LABEL', '');
      
      fs.writeFileSync(envPath, envData.trim() + '\n', 'utf8');
      return NextResponse.json({ success: true, reset: true });
    }

    if (!mode || !primary || !backup) {
      return NextResponse.json({ error: 'Missing mode, primary, or backup values' }, { status: 400 });
    }

    setOrReplaceEnv('FAILOVER_MODE', mode);
    setOrReplaceEnv('PRIMARY_TARGET', primary);
    setOrReplaceEnv('BACKUP_TARGET', backup);
    
    // For backwards compatibility and label usage
    setOrReplaceEnv('PRIMARY_INTERFACE', primary);
    setOrReplaceEnv('BACKUP_INTERFACE', backup);
    
    setOrReplaceEnv('PRIMARY_LABEL', `Primary ${mode === 'gateway' ? 'GW' : 'IF'}: ${primary}`);
    setOrReplaceEnv('BACKUP_LABEL', `Backup ${mode === 'gateway' ? 'GW' : 'IF'}: ${backup}`);

    fs.writeFileSync(envPath, envData.trim() + '\n', 'utf8');

    return NextResponse.json({ success: true, mode, primary, backup });
  } catch (error) {
    console.error('Error updating env:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
