import os
import re
from pathlib import Path

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Skip if no console calls
    if not re.search(r'console\.(log|error|warn)', content):
        return

    # Check if logger is already imported
    has_logger_import = 'import { logger } from' in content or 'import { logger } from "@/lib/logger"' in content
    
    # Needs import
    if not has_logger_import:
        # Find last import
        imports = list(re.finditer(r'^import .*?;?\n', content, flags=re.MULTILINE))
        if imports:
            last_import = imports[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + "import { logger } from '@/lib/logger';\n" + content[insert_pos:]
        else:
            content = "import { logger } from '@/lib/logger';\n\n" + content

    # Replace console calls. Very basic replacements to be safe.
    # We will do a generic replacement mapping console.X(...) to logger.X(..., { tag: 'API' })
    # This might require some manual fixing if there are multiline console logs, but we'll try a regex approach.
    
    def repl(m):
        func = m.group(1) # log, error, warn
        if func == 'log':
            func = 'info'
        args = m.group(2)
        # Attempt to split the first string argument if it looks like '[TAG] Msg'
        
        # Simple fallback:
        return f"logger.{func}({args})"

    # Note: re.sub with function is safer, but just replacing the literal 'console.log' with 'logger.info' etc 
    # without trying to perfectly parse args is safer to ensure it still compiles, though it might not perfectly match the { tag } style everywhere.
    
    # Actually, the quickest way is string replacement of the function name. The user's new logger supports:
    # logger.info(msg, meta)
    # logger.error(msg, meta)
    # If the user previously did console.log("something", value) -> logger.info("something", { value }) - this is hard to regex.
    # But wait, looking at `logger.ts` we wrote, let's see its signature.
    pass

def main():
    api_dir = Path('./app/api')
    for root, dirs, files in os.walk(api_dir):
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()
