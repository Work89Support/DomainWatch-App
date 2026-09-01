from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "help" / "vpn-mobile-flow.png"
FONT_REGULAR = ROOT / "public" / "fonts" / "Kanit-Regular.ttf"
FONT_BOLD = ROOT / "public" / "fonts" / "Kanit-SemiBold.ttf"


def font(path: Path, size: int):
    return ImageFont.truetype(str(path), size)


def centered(draw, box, text, text_font, fill):
    left, top, right, bottom = box
    bounds = draw.textbbox((0, 0), text, font=text_font)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    draw.text(((left + right - width) / 2, (top + bottom - height) / 2 - 3), text, font=text_font, fill=fill)


def build():
    image = Image.new("RGB", (1500, 520), "#F8FAFC")
    draw = ImageDraw.Draw(image)
    title_font = font(FONT_BOLD, 40)
    step_font = font(FONT_BOLD, 24)
    body_font = font(FONT_REGULAR, 20)
    number_font = font(FONT_BOLD, 28)
    draw.text((52, 34), "Flow เปิด VPN ก่อนเริ่ม DomainWatch Agent", font=title_font, fill="#172554")

    steps = [
        ("เปิด Mobile data TRUE", "ปิด Wi-Fi เพื่อให้ต้นทางเป็นซิม TRUE"),
        ("เปิดแอป Surfshark", "ค้นหา Thailand แล้วเลือก Bangkok"),
        ("กด Connect", "รอจนมือถือแสดงคำว่า VPN/รูปกุญแจ"),
        ("เปิด DomainWatch", "Agent: กด เริ่มตรวจตลอดเวลา แล้วรอ 5 นาที"),
    ]
    colors = ["#EAF0FF", "#ECFDF5", "#FFF7E6", "#EEF4FF"]
    border = ["#8AA9F8", "#6EE7B7", "#F6C453", "#7AA2FF"]
    box_width = 325
    gap = 34
    x = 52
    for index, ((heading, detail), fill, outline) in enumerate(zip(steps, colors, border), start=1):
        box = (x, 130, x + box_width, 448)
        draw.rounded_rectangle(box, radius=25, fill=fill, outline=outline, width=4)
        draw.ellipse((x + 126, 160, x + 198, 232), fill="#2458E6")
        centered(draw, (x + 126, 160, x + 198, 232), str(index), number_font, "white")
        heading_bounds = draw.textbbox((0, 0), heading, font=step_font)
        draw.text((x + (box_width - (heading_bounds[2] - heading_bounds[0])) / 2, 259), heading, font=step_font, fill="#172554")
        lines = detail.split(" แล้ว") if " แล้ว" in detail else [detail]
        y = 322
        for line_index, line in enumerate(lines):
            value = line if line_index == 0 else "แล้ว" + line
            bounds = draw.textbbox((0, 0), value, font=body_font)
            draw.text((x + (box_width - (bounds[2] - bounds[0])) / 2, y), value, font=body_font, fill="#475569")
            y += 38
        if index < len(steps):
            arrow_x = x + box_width + 9
            draw.line((arrow_x, 290, arrow_x + 18, 290), fill="#94A3B8", width=6)
            draw.polygon([(arrow_x + 18, 279), (arrow_x + 32, 290), (arrow_x + 18, 301)], fill="#94A3B8")
        x += box_width + gap
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, quality=94)
    print(OUT)


if __name__ == "__main__":
    build()
