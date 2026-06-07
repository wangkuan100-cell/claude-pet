from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CANVAS = (256, 256)
DEFAULT_LINES = ("dragon", "phoenix", "kitsune")


def soft_mask(shapes: list[tuple[str, object]], blur: int = 5) -> Image.Image:
  mask = Image.new("L", CANVAS, 0)
  draw = ImageDraw.Draw(mask)
  for kind, coords in shapes:
    if kind == "ellipse":
      draw.ellipse(coords, fill=255)
    elif kind == "polygon":
      draw.polygon(coords, fill=255)
    elif kind == "rectangle":
      draw.rectangle(coords, fill=255)
    else:
      raise ValueError(f"unknown shape: {kind}")
  return mask.filter(ImageFilter.GaussianBlur(blur))


def masked_layer(source: Image.Image, mask: Image.Image) -> Image.Image:
  layer = source.copy()
  alpha = source.getchannel("A")
  layer.putalpha(ImageChops.multiply(alpha, mask))
  return alpha_bleed(layer)


def alpha_bleed(image: Image.Image, passes: int = 12) -> Image.Image:
  """Fill fully-transparent pixels with nearby sprite colors so WebGL filtering has no white fringe."""
  src = image.convert("RGBA")
  alpha = src.getchannel("A")
  opaque_rgb = Image.composite(src.convert("RGB"), Image.new("RGB", CANVAS, (0, 0, 0)), alpha)
  work = Image.merge("RGBA", (*opaque_rgb.split(), alpha))
  transparent = ImageChops.invert(alpha)
  for _ in range(passes):
    expanded = work.filter(ImageFilter.MaxFilter(3))
    rgb = Image.composite(expanded.convert("RGB"), work.convert("RGB"), transparent)
    work = Image.merge("RGBA", (*rgb.split(), alpha))
  return work


def cut(mask: Image.Image, cutters: list[Image.Image], grow: int = 7) -> Image.Image:
  out = mask.copy()
  for cutter in cutters:
    expanded = cutter.filter(ImageFilter.MaxFilter(grow))
    out = ImageChops.subtract(out, expanded)
  return out


def checkerboard(size: tuple[int, int]) -> Image.Image:
  image = Image.new("RGBA", size, (244, 247, 250, 255))
  draw = ImageDraw.Draw(image)
  cell = 16
  for y in range(0, size[1], cell):
    for x in range(0, size[0], cell):
      if (x // cell + y // cell) % 2:
        draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(224, 231, 238, 255))
  return image


def save_layer(source: Image.Image, out_dir: Path, filename: str, mask: Image.Image) -> None:
  masked_layer(source, mask).save(out_dir / filename)


def full_mask() -> Image.Image:
  return Image.new("L", CANVAS, 255)


def half_mask(left: bool) -> Image.Image:
  mask = Image.new("L", CANVAS, 0)
  draw = ImageDraw.Draw(mask)
  if left:
    draw.rectangle((0, 0, 130, 256), fill=255)
  else:
    draw.rectangle((126, 0, 256, 256), fill=255)
  return mask.filter(ImageFilter.GaussianBlur(2))


def rig_layer(
  layer_id: str,
  filename: str,
  *,
  z: float,
  pivot: tuple[int, int],
  motion: str,
  x: float = 0,
  y: float = 0,
  scale: float = 1,
  opacity: float = 1,
  sway: float = 0,
  tilt: float = 0,
  phase: float = 0,
  direction: float = 1,
  clip: dict[str, object] | None = None,
) -> dict[str, object]:
  out: dict[str, object] = {
    "id": layer_id,
    "file": filename,
    "z": z,
    "x": x,
    "y": y,
    "scale": scale,
    "opacity": opacity,
    "sway": sway,
    "tilt": tilt,
    "phase": phase,
    "pivot": {"x": pivot[0], "y": pivot[1]},
    "motion": motion,
    "direction": direction,
  }
  if clip:
    out["clip"] = clip
  return out


def build_preview(line: str, out_dir: Path, files: list[str]) -> None:
  preview = checkerboard((len(files) * 256, 256))
  composite = checkerboard(CANVAS)
  composed_sprite = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
  for i, name in enumerate(files):
    layer = Image.open(out_dir / name).convert("RGBA")
    preview.alpha_composite(layer, (i * 256, 0))
    composed_sprite.alpha_composite(layer)
  composite.alpha_composite(composed_sprite)
  preview.save(Path(f"/tmp/code-pet-{line}-legendary-2p5d-preview.png"))
  composite.save(Path(f"/tmp/code-pet-{line}-legendary-2p5d-composite.png"))


def dragon_layers() -> tuple[dict[str, Image.Image], list[dict[str, object]]]:
  body = soft_mask([
    ("ellipse", (41, 49, 184, 167)),
    ("ellipse", (75, 112, 181, 244)),
    ("polygon", [(73, 134), (179, 132), (193, 239), (66, 239)]),
    ("ellipse", (80, 211, 124, 250)),
    ("ellipse", (130, 207, 178, 250)),
    ("rectangle", (72, 100, 189, 238)),
  ], 3)
  wing_left = soft_mask([
    ("ellipse", (23, 82, 79, 164)),
    ("polygon", [(35, 86), (78, 111), (68, 160), (27, 143), (28, 104)]),
    ("polygon", [(18, 111), (61, 101), (63, 139), (25, 158)]),
  ], 2)
  wing_right = soft_mask([
    ("ellipse", (172, 82, 219, 164)),
    ("polygon", [(175, 111), (215, 86), (218, 143), (180, 160), (166, 118)]),
    ("polygon", [(189, 101), (232, 111), (224, 158), (188, 139)]),
  ], 2)
  horns = soft_mask([
    ("ellipse", (43, -2, 95, 72)),
    ("ellipse", (113, 0, 167, 72)),
    ("polygon", [(70, 6), (95, 66), (60, 69), (45, 32)]),
    ("polygon", [(126, 7), (162, 28), (145, 70), (112, 66)]),
    ("ellipse", (82, 17, 118, 68)),
  ], 2)
  orb = soft_mask([
    ("ellipse", (185, 69, 244, 128)),
    ("ellipse", (205, 57, 227, 82)),
    ("polygon", [(213, 60), (219, 72), (232, 75), (220, 82), (215, 95), (209, 82), (197, 77), (208, 72)]),
  ], 2)
  tail = soft_mask([
    ("ellipse", (139, 118, 247, 239)),
    ("ellipse", (174, 102, 234, 181)),
    ("polygon", [(151, 157), (207, 111), (247, 153), (238, 237), (151, 238)]),
    ("rectangle", (139, 175, 247, 239)),
  ], 3)
  leg_back = soft_mask([
    ("ellipse", (70, 192, 118, 252)),
    ("rectangle", (76, 182, 113, 244)),
    ("ellipse", (63, 230, 123, 255)),
  ], 2)
  leg_front = soft_mask([
    ("ellipse", (119, 184, 181, 252)),
    ("rectangle", (127, 172, 173, 242)),
    ("ellipse", (118, 226, 190, 255)),
  ], 2)
  masks = {
    "body-core.png": body,
    "wing-left.png": wing_left,
    "wing-right.png": wing_right,
    "tail.png": tail,
    "leg-back.png": leg_back,
    "leg-front.png": leg_front,
    "horns-front.png": horns,
    "orb-front.png": orb,
  }
  layers = [
    rig_layer("body-core", "body-core.png", z=0.02, pivot=(128, 165), motion="body", sway=0.12, tilt=0.012, phase=0, clip={"idle": {"bob": 0.018}, "run": {"bob": 0.045, "rotate": 0.035}}),
    rig_layer("wing-left", "wing-left.png", z=-0.02, pivot=(75, 105), motion="wing", direction=-1, opacity=0.92, sway=0.18, tilt=0.02, phase=0.6, clip={"idle": {"rotate": 0.035}, "run": {"rotate": 0.075}}),
    rig_layer("wing-right", "wing-right.png", z=-0.015, pivot=(175, 105), motion="wing", direction=1, opacity=0.92, sway=0.18, tilt=0.02, phase=2.2, clip={"idle": {"rotate": 0.035}, "run": {"rotate": 0.075}}),
    rig_layer("tail", "tail.png", z=-0.03, pivot=(159, 173), motion="tail", direction=1, opacity=0.96, sway=0.34, tilt=0.04, phase=0.25, clip={"idle": {"rotate": 0.07}, "run": {"rotate": 0.16}}),
    rig_layer("leg-back", "leg-back.png", z=0.08, pivot=(96, 208), motion="leg", direction=-1, phase=0, clip={"idle": {"rotate": 0.018}, "run": {"rotate": 0.24, "bob": 0.018}}),
    rig_layer("leg-front", "leg-front.png", z=0.1, pivot=(147, 205), motion="leg", direction=1, phase=3.14, clip={"idle": {"rotate": 0.018}, "run": {"rotate": 0.24, "bob": 0.018}}),
    rig_layer("horns-front", "horns-front.png", z=0.14, pivot=(127, 74), motion="head", opacity=0.98, sway=0.1, tilt=0.012, phase=2.7, clip={"idle": {"rotate": 0.018}, "run": {"rotate": 0.035}}),
    rig_layer("orb-front", "orb-front.png", z=0.22, pivot=(215, 96), motion="float", opacity=0.94, sway=0.46, phase=3.25, clip={"idle": {"bob": 0.04}, "run": {"bob": 0.065}}),
  ]
  return masks, layers


def phoenix_layers() -> tuple[dict[str, Image.Image], list[dict[str, object]]]:
  flame_halo = soft_mask([
    ("ellipse", (39, -4, 221, 133)),
    ("polygon", [(82, 15), (118, 0), (154, 12), (132, 55), (96, 58)]),
    ("polygon", [(145, 9), (199, 38), (208, 92), (164, 75)]),
    ("polygon", [(49, 37), (89, 11), (94, 78), (43, 94)]),
  ], 4)
  wing_left = soft_mask([
    ("ellipse", (18, 117, 108, 217)),
    ("polygon", [(23, 125), (70, 145), (111, 184), (66, 218), (20, 197)]),
    ("polygon", [(34, 164), (95, 165), (74, 226), (20, 205)]),
  ], 2)
  wing_right = soft_mask([
    ("ellipse", (145, 116, 243, 218)),
    ("polygon", [(147, 181), (188, 140), (237, 121), (240, 199), (190, 222)]),
    ("polygon", [(166, 165), (229, 165), (240, 207), (183, 226)]),
  ], 2)
  body = soft_mask([
    ("ellipse", (45, 38, 213, 158)),
    ("ellipse", (61, 58, 195, 185)),
    ("ellipse", (76, 126, 183, 244)),
    ("polygon", [(80, 158), (174, 158), (187, 238), (66, 238)]),
    ("rectangle", (72, 115, 185, 230)),
  ], 3)
  body_raw = soft_mask([
    ("ellipse", (61, 58, 195, 185)),
    ("ellipse", (76, 126, 183, 244)),
    ("polygon", [(80, 158), (174, 158), (187, 238), (66, 238)]),
    ("ellipse", (86, 222, 119, 250)),
    ("ellipse", (134, 222, 167, 250)),
  ], 3)
  crest = soft_mask([
    ("ellipse", (101, 61, 136, 105)),
    ("polygon", [(106, 17), (150, 10), (174, 62), (132, 83), (95, 61)]),
    ("polygon", [(88, 22), (128, 6), (121, 70), (79, 82)]),
    ("polygon", [(134, 20), (183, 42), (148, 92), (118, 70)]),
  ], 2)
  foot_left = soft_mask([
    ("ellipse", (76, 218, 119, 254)),
    ("polygon", [(83, 230), (105, 222), (122, 242), (91, 253), (74, 243)]),
  ], 2)
  foot_right = soft_mask([
    ("ellipse", (130, 218, 172, 254)),
    ("polygon", [(134, 242), (151, 222), (173, 230), (180, 243), (149, 253)]),
  ], 2)
  masks = {
    "body-core.png": body,
    "wing-left.png": wing_left,
    "wing-right.png": wing_right,
    "foot-left.png": foot_left,
    "foot-right.png": foot_right,
    "flame-halo.png": cut(flame_halo, [body_raw, wing_left, wing_right], 3),
    "crest-front.png": crest,
  }
  layers = [
    rig_layer("body-core", "body-core.png", z=0.03, pivot=(128, 163), motion="body", sway=0.14, tilt=0.014, phase=0, clip={"idle": {"bob": 0.018}, "run": {"bob": 0.05, "rotate": 0.035}, "hop": {"bob": 0.08}}),
    rig_layer("wing-left", "wing-left.png", z=-0.03, pivot=(91, 153), motion="wing", direction=-1, opacity=0.98, sway=0.24, tilt=0.045, phase=0.15, clip={"idle": {"rotate": 0.11}, "run": {"rotate": 0.24}, "hop": {"rotate": 0.3}}),
    rig_layer("wing-right", "wing-right.png", z=-0.025, pivot=(164, 153), motion="wing", direction=1, opacity=0.98, sway=0.24, tilt=0.045, phase=3.3, clip={"idle": {"rotate": 0.11}, "run": {"rotate": 0.24}, "hop": {"rotate": 0.3}}),
    rig_layer("foot-left", "foot-left.png", z=0.11, pivot=(99, 226), motion="leg", direction=-1, phase=0, clip={"idle": {"rotate": 0.02}, "run": {"rotate": 0.22, "bob": 0.018}}),
    rig_layer("foot-right", "foot-right.png", z=0.12, pivot=(151, 226), motion="leg", direction=1, phase=3.14, clip={"idle": {"rotate": 0.02}, "run": {"rotate": 0.22, "bob": 0.018}}),
    rig_layer("flame-halo", "flame-halo.png", z=-0.06, pivot=(128, 92), motion="aura", opacity=0.54, sway=0.22, tilt=0.012, phase=0.1, clip={"idle": {"bob": 0.03}, "run": {"bob": 0.055}}),
    rig_layer("crest-front", "crest-front.png", z=0.16, pivot=(129, 76), motion="head", opacity=0.98, sway=0.12, tilt=0.014, phase=2.75, clip={"idle": {"rotate": 0.025}, "run": {"rotate": 0.045}}),
  ]
  return masks, layers


def kitsune_layers() -> tuple[dict[str, Image.Image], list[dict[str, object]]]:
  tails = soft_mask([
    ("ellipse", (1, 92, 89, 223)),
    ("ellipse", (17, 41, 95, 149)),
    ("ellipse", (157, 44, 239, 154)),
    ("ellipse", (166, 94, 255, 223)),
    ("ellipse", (29, 139, 109, 240)),
    ("ellipse", (146, 139, 227, 240)),
    ("rectangle", (18, 122, 240, 238)),
  ], 4)
  body_raw = soft_mask([
    ("ellipse", (78, 126, 178, 248)),
    ("polygon", [(86, 149), (170, 149), (183, 242), (70, 242)]),
    ("ellipse", (72, 214, 111, 252)),
    ("ellipse", (142, 214, 182, 252)),
  ], 3)
  head_raw = soft_mask([
    ("ellipse", (43, 54, 213, 177)),
    ("ellipse", (56, 92, 203, 190)),
    ("polygon", [(52, 130), (204, 130), (186, 193), (69, 193)]),
  ], 3)
  ears = soft_mask([
    ("polygon", [(47, 21), (95, 88), (51, 117)]),
    ("polygon", [(210, 21), (161, 88), (205, 117)]),
    ("polygon", [(86, 17), (128, 3), (169, 18), (141, 70), (114, 68)]),
    ("ellipse", (55, 36, 93, 98)),
    ("ellipse", (163, 36, 202, 98)),
  ], 2)
  aura = soft_mask([
    ("ellipse", (112, 63, 143, 103)),
    ("ellipse", (91, 143, 166, 196)),
    ("polygon", [(107, 145), (128, 171), (149, 145), (159, 183), (128, 205), (96, 183)]),
  ], 2)
  tail_accents = cut(tails, [body_raw, head_raw, ears, aura], 3)
  head_ears = ImageChops.lighter(head_raw, ears)
  leg_back = soft_mask([
    ("ellipse", (73, 179, 121, 253)),
    ("rectangle", (80, 171, 115, 244)),
    ("ellipse", (70, 227, 126, 256)),
  ], 2)
  leg_front = soft_mask([
    ("ellipse", (133, 179, 184, 253)),
    ("rectangle", (140, 171, 177, 244)),
    ("ellipse", (128, 227, 190, 256)),
  ], 2)
  masks = {
    "body-core.png": body_raw,
    "head-ears.png": head_ears,
    "tails-left.png": ImageChops.multiply(tail_accents, half_mask(True)),
    "tails-right.png": ImageChops.multiply(tail_accents, half_mask(False)),
    "leg-back.png": leg_back,
    "leg-front.png": leg_front,
    "aura-front.png": aura,
  }
  layers = [
    rig_layer("body-core", "body-core.png", z=0.04, pivot=(128, 178), motion="body", sway=0.12, tilt=0.012, phase=0, clip={"idle": {"bob": 0.016}, "run": {"bob": 0.048, "rotate": 0.032}}),
    rig_layer("head-ears", "head-ears.png", z=0.11, pivot=(128, 124), motion="head", sway=0.16, tilt=0.018, phase=2.1, clip={"idle": {"rotate": 0.026}, "run": {"rotate": 0.05}}),
    rig_layer("tails-left", "tails-left.png", z=-0.055, pivot=(98, 150), motion="tail", direction=-1, opacity=0.98, sway=0.44, tilt=0.04, phase=0.25, clip={"idle": {"rotate": 0.085}, "run": {"rotate": 0.18}}),
    rig_layer("tails-right", "tails-right.png", z=-0.05, pivot=(158, 150), motion="tail", direction=1, opacity=0.98, sway=0.48, tilt=0.042, phase=1.65, clip={"idle": {"rotate": 0.085}, "run": {"rotate": 0.18}}),
    rig_layer("leg-back", "leg-back.png", z=0.08, pivot=(98, 204), motion="leg", direction=-1, phase=0, clip={"idle": {"rotate": 0.018}, "run": {"rotate": 0.23, "bob": 0.018}}),
    rig_layer("leg-front", "leg-front.png", z=0.1, pivot=(154, 204), motion="leg", direction=1, phase=3.14, clip={"idle": {"rotate": 0.018}, "run": {"rotate": 0.23, "bob": 0.018}}),
    rig_layer("aura-front", "aura-front.png", z=0.16, pivot=(128, 144), motion="float", opacity=0.74, sway=0.34, phase=3.15, clip={"idle": {"bob": 0.035}, "run": {"bob": 0.06}}),
  ]
  return masks, layers


BUILDERS = {
  "dragon": dragon_layers,
  "phoenix": phoenix_layers,
  "kitsune": kitsune_layers,
}


def build_line(line: str) -> None:
  source_file = ROOT / "assets" / line / "legendary.png"
  out_dir = ROOT / "assets" / "layers" / line / "legendary"
  out_dir.mkdir(parents=True, exist_ok=True)
  for old_png in out_dir.glob("*.png"):
    old_png.unlink()
  source = Image.open(source_file).convert("RGBA")
  masks, layers = BUILDERS[line]()
  for layer in layers:
    save_layer(source, out_dir, str(layer["file"]), masks[str(layer["file"])])
  (out_dir / "manifest.json").write_text(
    json.dumps(
      {
        "version": 2,
        "source": f"../../{line}/legendary.png",
        "canvas": {"width": 256, "height": 256},
        "layers": layers,
      },
      indent=2,
    )
    + "\n",
    encoding="utf-8",
  )
  build_preview(line, out_dir, [str(layer["file"]) for layer in layers])
  print(f"wrote {out_dir}")
  print(f"preview /tmp/code-pet-{line}-legendary-2p5d-preview.png")
  print(f"composite /tmp/code-pet-{line}-legendary-2p5d-composite.png")


def main() -> None:
  lines = tuple(sys.argv[1:]) or DEFAULT_LINES
  unknown = [line for line in lines if line not in BUILDERS]
  if unknown:
    raise SystemExit(f"unknown line(s): {', '.join(unknown)}")
  for line in lines:
    build_line(line)


if __name__ == "__main__":
  main()
