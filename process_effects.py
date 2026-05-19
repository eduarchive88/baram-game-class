import os
from PIL import Image

src_effects = {
    'double_slash.png': 'C:/Users/eduar/.gemini/antigravity/brain/13ddd980-9bcc-43ec-9b37-d862a67a972e/double_slash_effect_1779155492151.png',
    'triple_slash.png': 'C:/Users/eduar/.gemini/antigravity/brain/13ddd980-9bcc-43ec-9b37-d862a67a972e/triple_slash_effect_1779155510046.png',
    'critical.png': 'C:/Users/eduar/.gemini/antigravity/brain/13ddd980-9bcc-43ec-9b37-d862a67a972e/critical_effect_1779155525153.png',
    'explosion.png': 'C:/Users/eduar/.gemini/antigravity/brain/13ddd980-9bcc-43ec-9b37-d862a67a972e/explosion_effect_1779155540981.png',
    'holy.png': 'C:/Users/eduar/.gemini/antigravity/brain/13ddd980-9bcc-43ec-9b37-d862a67a972e/holy_effect_1779155558156.png',
    'impact.png': 'C:/Users/eduar/.gemini/antigravity/brain/13ddd980-9bcc-43ec-9b37-d862a67a972e/impact_effect_1779155572305.png'
}

dest_dir = 'c:/Users/eduar/OneDrive/Desktop/baram game class/public/assets/images/effects'

def process_effect_image(src_path, dest_path):
    if not os.path.exists(src_path):
        print(f"Error: {src_path} not found")
        return False
        
    img = Image.open(src_path).convert('RGBA')
    width, height = img.size
    pixels = img.load()
    
    # 배경 노이즈 제거 (완벽 투명화)
    # 검은색 계열 및 흰색/연회색 계열 투명화
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            
            # 검은색 계열 배경
            if r < 35 and g < 35 and b < 35:
                pixels[x, y] = (255, 255, 255, 0)
            # 흰색/회색 계열 배경 (그라데이션 및 노이즈 포함)
            elif r > 220 and g > 220 and b > 220:
                if abs(r - g) < 20 and abs(g - b) < 20:
                    pixels[x, y] = (255, 255, 255, 0)
            # 미세 잔여 노이즈
            elif r > 180 and g > 180 and b > 180 and abs(r - g) < 15 and abs(g - b) < 15:
                pixels[x, y] = (255, 255, 255, 0)
                
    # 64x64 크기로 리사이징하여 게임 내 픽셀아트 이펙트 크기에 정확히 맞춤
    img_resized = img.resize((64, 64), Image.Resampling.LANCZOS)
    
    # 저장
    img_resized.save(dest_path, 'PNG')
    print(f"Saved processed effect to {dest_path}")
    return True

print("=== Starting Effect Image Processing ===")
os.makedirs(dest_dir, exist_ok=True)
for filename, src_path in src_effects.items():
    dest_path = os.path.join(dest_dir, filename)
    process_effect_image(src_path, dest_path)
print("=== Effect Preprocessing Completed! ===")
