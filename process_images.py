import os
from PIL import Image
import re

src_dir = 'C:/Users/eduar/.gemini/antigravity/brain/7ecf7f0b-f88d-4a08-9690-526991b30f3f'
dest_dir = 'c:/Users/eduar/OneDrive/Desktop/baram game class/public/assets'

files_config = [
    {'name': 'house', 'pattern': r'house_asset_\d+\.png'},
    {'name': 'fountain', 'pattern': r'fountain_asset_\d+\.png'},
    {'name': 'tree_large', 'pattern': r'large_tree_asset_\d+\.png'},
    {'name': 'ruins', 'pattern': r'ruins_asset_\d+\.png'},
    {'name': 'npc_guard', 'pattern': r'npc_guard_\d+\.png'},
    {'name': 'npc_merchant', 'pattern': r'npc_merchant_\d+\.png'}
]

all_files = os.listdir(src_dir)

for config in files_config:
    for filename in all_files:
        if re.match(config['pattern'], filename):
            print(f"Processing {filename} to {config['name']}.png")
            filepath = os.path.join(src_dir, filename)
            try:
                img = Image.open(filepath).convert('RGBA')
                
                data = img.getdata()
                new_data = []
                for item in data:
                    # Remove white-ish backgrounds
                    if (item[0] > 240 and item[1] > 240 and item[2] > 240) or (item[0] == 0 and item[1] == 0 and item[2] == 0 and item[3] == 255):
                        new_data.append((255, 255, 255, 0))
                    else:
                        new_data.append(item)
                img.putdata(new_data)
                
                if config['name'].startswith('npc_'):
                    width, height = img.size
                    ratio = 64.0 / width
                    img = img.resize((64, int(height * ratio)), Image.Resampling.LANCZOS)
                elif config['name'] in ['house', 'tree_large', 'ruins']:
                    width, height = img.size
                    ratio = 128.0 / width
                    img = img.resize((128, int(height * ratio)), Image.Resampling.LANCZOS)
                else:
                    width, height = img.size
                    ratio = 96.0 / width
                    img = img.resize((96, int(height * ratio)), Image.Resampling.LANCZOS)
                    
                dest_path = os.path.join(dest_dir, 'mega_' + config['name'] + '.png')
                img.save(dest_path, 'PNG')
                print(f"Saved {dest_path}")
            except Exception as e:
                print(f"Error processing {filename}: {e}")
            break
