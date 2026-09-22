#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「我和 AI 的圆桌会」卡通 GIF 动画。"""
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 500

# ---------- 颜色 ----------
BG        = (245, 242, 236)
FLOOR     = (234, 226, 214)
TITLE_C   = (74, 64, 53)
SKIN      = (246, 201, 154)
CHEEK     = (242, 163, 160)
HAIR      = (74, 59, 50)
SHIRT     = (74, 123, 196)
SHIRT_DK  = (58, 100, 168)
EYE       = (40, 38, 42)
MOUTH     = (199, 87, 63)
BODY_BOT  = (158, 171, 185)
HEAD_BOT  = (217, 224, 230)
HEAD_BOT_D=(186, 196, 206)
EYE_ON    = (59, 198, 182)
EYE_TALK  = (255, 201, 61)
ANT_LED   = (226, 74, 74)
ANT_LED_G = (80, 200, 120)
TABLE     = (185, 131, 79)
TABLE_HI  = (208, 164, 115)
TABLE_LG  = (138, 106, 69)
BUBBLE_BG = (255, 255, 255)
BUBBLE_BR = (120, 112, 104)

def font(sz):
    for p in ["/System/Library/Fonts/STHeiti Medium.ttc",
              "/System/Library/Fonts/Hiragino Sans GB.ttc",
              "/System/Library/Fonts/Supplemental/Songti.ttc"]:
        try:
            return ImageFont.truetype(p, sz, index=0)
        except Exception:
            continue
    return ImageFont.load_default()

F_TITLE = font(34)
F_BUBBLE = font(21)

def base():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 400, W, H], fill=FLOOR)
    d.rectangle([0, 398, W, 404], fill=(210, 200, 186))
    d.text((400, 28), "我和 AI 的圆桌会", font=F_TITLE, fill=TITLE_C, anchor="mm")
    return img, d

def draw_table(d):
    # 桌腿
    d.rounded_rectangle([352, 320, 384, 442], radius=6, fill=TABLE_LG)
    d.rounded_rectangle([416, 320, 448, 442], radius=6, fill=TABLE_LG)
    # 桌面
    d.ellipse([238, 268, 562, 358], fill=TABLE)
    d.ellipse([250, 278, 550, 350], fill=TABLE_HI)
    # 咖啡杯
    d.rectangle([382, 250, 418, 288], fill=(255, 255, 255))
    d.arc([386, 244, 414, 264], 180, 360, fill=(160, 90, 60), width=5)

def draw_person(d, cx, talk):
    """人类「我」。"""
    top = 118
    # 手臂
    d.line([cx-40, 320, cx-30, 296], fill=SHIRT, width=18)
    d.line([cx+40, 320, cx+30, 296], fill=SHIRT, width=18)
    # 身体
    d.rounded_rectangle([cx-48, 238, cx+48, 384], radius=42, fill=SHIRT)
    d.rounded_rectangle([cx-48, 238, cx+48, 384], radius=42, outline=SHIRT_DK, width=2)
    # 领子
    d.polygon([(cx-16, 258), (cx, 288), (cx+16, 258)], fill=(255, 255, 255))
    # 头
    r = 46
    d.ellipse([cx-r, top, cx+r, top+2*r], fill=SKIN)
    # 头发
    d.pieslice([cx-r-2, top-4, cx+r+2, top+2*r-18], 180, 360, fill=HAIR)
    d.ellipse([cx-52, top+20, cx-16, top+56], fill=HAIR)   # 侧发
    d.ellipse([cx+16, top+20, cx+52, top+56], fill=HAIR)
    # 腮红
    d.ellipse([cx-40, top+52, cx-22, top+70], fill=CHEEK)
    d.ellipse([cx+22, top+52, cx+40, top+70], fill=CHEEK)
    # 眼睛
    ey = top + 34
    for ex in (cx-18, cx+18):
        d.ellipse([ex-6, ey-7, ex+6, ey+7], fill=EYE)
        d.ellipse([ex-2, ey-4, ex+2, ey-1], fill=(255, 255, 255))
    # 眉毛
    d.arc([cx-24, ey-22, cx-12, ey-12], 20, 160, fill=HAIR, width=3)
    d.arc([cx+12, ey-22, cx+24, ey-12], 20, 160, fill=HAIR, width=3)
    # 嘴
    my = top + 68
    if talk:
        d.ellipse([cx-11, my-8, cx+11, my+10], fill=MOUTH)
        d.ellipse([cx-11, my-8, cx+11, my+2], fill=(120, 50, 40))
    else:
        d.arc([cx-12, my-10, cx+12, my+8], 15, 165, fill=MOUTH, width=4)

def draw_robot(d, cx, talk, dots):
    """AI 机器人。"""
    top = 124
    # 天线
    d.line([cx, top-26, cx, top-6], fill=HEAD_BOT_D, width=5)
    d.ellipse([cx-7, top-34, cx+7, top-20], fill=ANT_LED_G if talk else ANT_LED)
    # 耳朵
    d.rounded_rectangle([cx-56, top+24, cx-44, top+48], radius=5, fill=BODY_BOT)
    d.rounded_rectangle([cx+44, top+24, cx+56, top+48], radius=5, fill=BODY_BOT)
    # 手臂
    d.line([cx-42, 322, cx-32, 296], fill=BODY_BOT, width=18)
    d.line([cx+42, 322, cx+32, 296], fill=BODY_BOT, width=18)
    # 身体
    d.rounded_rectangle([cx-48, 244, cx+48, 384], radius=36, fill=BODY_BOT)
    d.rounded_rectangle([cx-30, 268, cx+30, 300], radius=8, fill=(255, 255, 255))
    d.ellipse([cx-10, 272, cx+10, 292], fill=(120, 180, 130) if talk else (80, 170, 200))
    # 头（圆角方形）
    r = 40
    d.rounded_rectangle([cx-r, top, cx+r, top+2*r], radius=26, fill=HEAD_BOT)
    d.rounded_rectangle([cx-r, top, cx+r, top+2*r], radius=26, outline=HEAD_BOT_D, width=2)
    # 眼睛（屏幕）
    for ex in (cx-24, cx+2):
        d.rounded_rectangle([ex, top+30, ex+22, top+54], radius=6,
                            fill=EYE_TALK if talk else EYE_ON)
        d.rectangle([ex+5, top+35, ex+9, top+40], fill=(240, 250, 250))
    # 嘴
    my = top + 70
    if talk:
        d.rounded_rectangle([cx-10, my-6, cx+10, my+6], radius=4, fill=EYE_TALK)
    else:
        d.line([cx-12, my+2, cx+12, my+2], fill=(90, 100, 110), width=4)
    # 思考点
    if dots:
        for i, dx in enumerate([6, 22, 38]):
            rdot = 4
            d.ellipse([cx+dx-rdot, top-6, cx+dx+rdot, top-4+rdot*2], fill=(120, 116, 112))

def draw_bubble(d, cx, text, owner):
    bw = max(170, len(text) * 21 + 44)
    bh = 54
    y0 = 40
    bx = min(max(cx - bw // 2, 6), W - bw - 6)
    # 尾巴
    tx = cx if owner == "human" else cx
    ty = y0 + bh
    d.polygon([(tx-12, ty-2), (tx+12, ty-2), (tx, ty+22)], fill=BUBBLE_BG)
    d.line([(tx-12, ty-2), (tx, ty+22), (tx+12, ty-2)], fill=BUBBLE_BR, width=2)
    d.rounded_rectangle([bx, y0, bx+bw, y0+bh], radius=18, fill=BUBBLE_BG,
                        outline=BUBBLE_BR, width=3)
    d.text((bx + bw // 2, y0 + bh // 2 - 1), text, font=F_BUBBLE, fill=(60, 54, 48), anchor="mm")

def draw_center_spark(d):
    d.polygon([(400, 180), (406, 196), (424, 196), (410, 206), (415, 224),
               (400, 212), (385, 224), (390, 206), (376, 196), (394, 196)],
              fill=(255, 190, 60), outline=(220, 140, 40))

def render(st):
    img, d = base()
    draw_table(d)
    draw_person(d, 190, st["human"] == "talk")
    draw_robot(d, 610, st["robot"] == "talk", st["dots"])
    if st["center"]:
        draw_center_spark(d)
    b = st["bubble"]
    if b:
        if b["owner"] == "human":
            draw_bubble(d, 190, b["text"], "human")
        else:
            draw_bubble(d, 610, b["text"], "robot")
    return img

frames = [
    dict(human="smile", robot="normal", dots=False, bubble=None, center=False, ms=500),
    dict(human="talk",  robot="normal", dots=False,
         bubble=dict(owner="human", text="你好，我们一起讨论～"), center=False, ms=650),
    dict(human="talk",  robot="normal", dots=False,
         bubble=dict(owner="human", text="你好，我们一起讨论～"), center=False, ms=650),
    dict(human="smile", robot="normal", dots=True,  bubble=None, center=False, ms=480),
    dict(human="smile", robot="talk",   dots=False,
         bubble=dict(owner="robot", text="好呀，我来说说我的想法～"), center=False, ms=650),
    dict(human="smile", robot="talk",   dots=False,
         bubble=dict(owner="robot", text="好呀，我来说说我的想法～"), center=False, ms=650),
    dict(human="smile", robot="normal", dots=False, bubble=None, center=True, ms=520),
]

imgs = [render(f) for f in frames]
durations = [f["ms"] for f in frames]

out = "/Users/violin/projects/ic/roundtable.gif"
imgs[0].save(out, save_all=True, append_images=imgs[1:],
             duration=durations, loop=0, disposal=2, optimize=True)
# 预览：导出两帧 PNG
imgs[1].save("/Users/violin/projects/ic/preview_human.png")
imgs[4].save("/Users/violin/projects/ic/preview_robot.png")
print("saved", out, "frames", len(imgs))