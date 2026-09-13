import os

replacements = {
    'Z-LIVE STREAMING - CLOUDFLARE HLS TUNNEL STARTER': 'Z-LIVE STREAMING - CLOUDFLARE HLS TUNNEL STARTER',
    'tk.Label(bar, text=\"SOYZA\",': 'tk.Label(bar, text=\"Z-Live\",',
    'https://zlive-streaming.vercel.app': 'https://zlive-streaming.vercel.app',
    'zlive-streaming GitHub repo': 'zlive-streaming GitHub repo',
}

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        for k, v in replacements.items():
            new_content = new_content.replace(k, v)
            
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filepath}')
    except Exception as e:
        pass

for root, dirs, files in os.walk('.'):
    # Skip .git, node_modules, venv, __pycache__, .next
    dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', 'venv', '__pycache__', '.next', 'dist', 'build']]
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.py', '.bat', '.json', '.md', '.yml')):
            replace_in_file(os.path.join(root, file))
