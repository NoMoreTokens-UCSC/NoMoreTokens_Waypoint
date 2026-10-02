"""Generate install icons from the application's simple navigation mark."""
from pathlib import Path
from PIL import Image, ImageDraw

directory = Path(__file__).resolve().parents[1] / 'public/icons'
directory.mkdir(parents=True, exist_ok=True)
for size in (192, 512):
    image = Image.new('RGB', (size, size), '#f26a2e')
    draw = ImageDraw.Draw(image)
    draw.polygon([(size*.30, size*.30), (size*.70, size*.45), (size*.52, size*.52), (size*.45, size*.70)], fill='white')
    image.save(directory / f'icon-{size}.png')
