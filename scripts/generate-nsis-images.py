import os
from PIL import Image, ImageDraw

def create_sidebar():
    width, height = 164, 314
    image = Image.new('RGB', (width, height), '#0f172a')
    draw = ImageDraw.Draw(image)
    
    # 渐变背景 (Deep Dark Slate to Coolapk Green)
    for y in range(height):
        r = int(15 + (10 - 15) * (y / height))
        g = int(23 + (187 - 23) * (y / height))
        b = int(42 + (120 - 42) * (y / height))
        draw.line([(0, y), (width, y)], fill=(r, g, b))
        
    # 读取应用图标并等比缩放
    icon_path = os.path.join('src-tauri', 'icons', 'icon.png')
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert('RGBA')
        icon = icon.resize((84, 84), Image.Resampling.LANCZOS)
        # 居中放置在上方
        icon_x = (width - 84) // 2
        icon_y = 60
        image.paste(icon, (icon_x, icon_y), icon)

    sidebar_path = os.path.join('src-tauri', 'icons', 'nsis-sidebar.bmp')
    image.save(sidebar_path, 'BMP')
    print(f"Sidebar saved to {sidebar_path}")

def create_header():
    width, height = 150, 57
    image = Image.new('RGB', (width, height), '#ffffff')
    
    icon_path = os.path.join('src-tauri', 'icons', 'icon.png')
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert('RGBA')
        icon = icon.resize((42, 42), Image.Resampling.LANCZOS)
        icon_x = width - 48
        icon_y = (height - 42) // 2
        image.paste(icon, (icon_x, icon_y), icon)

    header_path = os.path.join('src-tauri', 'icons', 'nsis-header.bmp')
    image.save(header_path, 'BMP')
    print(f"Header saved to {header_path}")

if __name__ == '__main__':
    create_sidebar()
    create_header()
