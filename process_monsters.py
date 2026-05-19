import os
from PIL import Image
from collections import deque

monster_dir = 'c:/Users/eduar/OneDrive/Desktop/baram game class/public/assets/images/monsters'
target_monsters = {
    'crow.png': {'tolerance': 70, 'white_threshold': 200},
    'fox.png': {'tolerance': 85, 'white_threshold': 190},
    'ice_slime.png': {'tolerance': 80, 'white_threshold': 220, 'dark_threshold': 110},
    'ice_spirit.png': {'tolerance': 75, 'white_threshold': 210},
    'rabbit.png': {'tolerance': 75, 'white_threshold': 200},
    'red_slime.png': {'tolerance': 75, 'white_threshold': 190},
    'squirrel.png': {'tolerance': 70, 'white_threshold': 210},
    'wasp.png': {'tolerance': 70, 'white_threshold': 210},
    'yeti.png': {'tolerance': 75, 'white_threshold': 210}
}

def remove_background_floodfill(image_path, config):
    if not os.path.exists(image_path):
        print(f"Error: {image_path} does not exist.")
        return False
        
    img = Image.open(image_path).convert('RGBA')
    width, height = img.size
    pixels = img.load()
    
    # 1. 대표 배경색 추출 (알파 채널이 불투명한 모서리 픽셀 중심)
    corners = [
        pixels[0, 0],
        pixels[width - 1, 0],
        pixels[0, height - 1],
        pixels[width - 1, height - 1]
    ]
    r_sum, g_sum, b_sum, bg_count = 0, 0, 0, 0
    for c in corners:
        if c[3] > 0: # 투명하지 않은 픽셀만 평균에 포함
            r_sum += c[0]
            g_sum += c[1]
            b_sum += c[2]
            bg_count += 1
            
    if bg_count > 0:
        bg_r = r_sum // bg_count
        bg_g = g_sum // bg_count
        bg_b = b_sum // bg_count
    else:
        # 모서리가 전부 투명하면 기본 흰색을 배경색으로 설정
        bg_r, bg_g, bg_b = 255, 255, 255
    
    print(f"  Target Background Color: RGB({bg_r}, {bg_g}, {bg_b})")
    
    # 2. Flood Fill을 위한 BFS 큐 준비
    queue = deque()
    visited = [[False for _ in range(height)] for _ in range(width)]
    
    tolerance = config.get('tolerance', 75)
    white_thresh = config.get('white_threshold', 200)
    dark_thresh = config.get('dark_threshold', None)
    
    # 배경으로 판정할 조건 함수
    def is_background_pixel(x, y):
        r, g, b, a = pixels[x, y]
        if a == 0:
            return False
            
        # 대표 배경색과의 거리 계산
        dr = abs(r - bg_r)
        dg = abs(g - bg_g)
        db = abs(b - bg_b)
        
        # 1) 대표 배경색과 유사도가 높은 경우
        if dr < tolerance and dg < tolerance and db < tolerance:
            return True
            
        # 2) 순수 흰색/회색 계열 노이즈 제거 (임계값 이상)
        if r > white_thresh and g > white_thresh and b > white_thresh:
            if abs(r - g) < 25 and abs(g - b) < 25:
                return True
                
        # 3) 특정 몬스터의 어두운 회색 배경 제거 (ice_slime 등)
        if dark_thresh is not None:
            if r < dark_thresh and g < dark_thresh and b < dark_thresh:
                if abs(r - g) < 20 and abs(g - b) < 20:
                    return True
                    
        return False

    # 이미 투명한 모든 픽셀과 외곽 경계선을 큐의 시작점으로 주입
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            if a == 0:
                queue.append((x, y))
                visited[x][y] = True
            elif x == 0 or x == width - 1 or y == 0 or y == height - 1:
                if is_background_pixel(x, y):
                    queue.append((x, y))
                    visited[x][y] = True
            
    # 3. BFS (Flood Fill) 탐색 실행
    dx = [-1, 1, 0, 0, -1, -1, 1, 1]
    dy = [0, 0, -1, 1, -1, 1, -1, 1]
    
    count = 0
    while queue:
        x, y = queue.popleft()
        # 배경 픽셀 투명화
        pixels[x, y] = (255, 255, 255, 0)
        count += 1
        
        for i in range(8):
            nx, ny = x + dx[i], y + dy[i]
            if 0 <= nx < width and 0 <= ny < height:
                if not visited[nx][ny] and is_background_pixel(nx, ny):
                    visited[nx][ny] = True
                    queue.append((nx, ny))
                    
    # 4. 미세 외곽 노이즈 스무딩 (투명한 픽셀과 닿아있는 하얀색 계열 픽셀 추가 투명화)
    # 2차로 투명 픽셀 주변에 남아있는 연한 회색/흰색 테두리를 아주 살짝 깎아줍니다.
    smoothed = 0
    for x in range(1, width - 1):
        for y in range(1, height - 1):
            r, g, b, a = pixels[x, y]
            if a > 0: # 아직 살아있는 픽셀 중
                # 주변 8칸 중 투명해진 픽셀이 있는지 확인
                has_transparent_neighbor = False
                for i in range(8):
                    nx, ny = x + dx[i], y + dy[i]
                    if pixels[nx, ny][3] == 0:
                        has_transparent_neighbor = True
                        break
                
                # 투명 이웃이 있고, 상당히 하얀색/연회색에 가까운 픽셀이면 미세 테두리로 간주하여 제거
                if has_transparent_neighbor:
                    # 회색/흰색 노이즈 제거 조건 완화
                    if r > 160 and g > 160 and b > 160 and abs(r - g) < 30 and abs(g - b) < 30:
                        pixels[x, y] = (255, 255, 255, 0)
                        smoothed += 1
                    # 혹은 대표 배경색과 여전히 꽤 유사한 픽셀인 경우
                    elif abs(r - bg_r) < (tolerance + 20) and abs(g - bg_g) < (tolerance + 20) and abs(b - bg_b) < (tolerance + 20):
                        pixels[x, y] = (255, 255, 255, 0)
                        smoothed += 1
                        
    # 5. 결과 저장
    img.save(image_path, 'PNG')
    print(f"  Processed {os.path.basename(image_path)}: Cleared {count} px, Smoothed {smoothed} px.")
    return True

print("=== Starting Monster Image Preprocessing ===")
for name, config in target_monsters.items():
    path = os.path.join(monster_dir, name)
    print(f"Processing {name}...")
    remove_background_floodfill(path, config)
print("=== Preprocessing Completed! ===")
