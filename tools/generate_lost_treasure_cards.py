import io
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

try:
    from rembg import new_session, remove as rembg_remove
except Exception:
    new_session = None
    rembg_remove = None


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "script.js"
CARD_TEMPLATE = ROOT / "images" / "lostTreasure" / "Cards" / "Card.png"
RARE_TEMPLATE = ROOT / "images" / "lostTreasure" / "Cards" / "RareCard.png"
OUT_DIR = ROOT / "images" / "lostTreasure" / "Cards" / "generated"
SOURCE_DIR = ROOT / "images" / "lostTreasure" / "Cards" / "source"
CUTOUT_DIR = ROOT / "images" / "lostTreasure" / "Cards" / "completed"
MANIFEST = ROOT / "images" / "lostTreasure" / "Cards" / "generated-manifest.json"

USER_AGENT = "SharkdleLostTreasuresCardGenerator/1.0"

ALIASES = {
    "Great White Shark": ["great white shark", "Carcharodon carcharias"],
    "Hammerhead Shark": ["scalloped hammerhead", "Sphyrna lewini"],
    "Whale Shark": ["whale shark", "Rhincodon typus"],
    "Tiger Shark": ["tiger shark", "Galeocerdo cuvier"],
    "Bull Shark": ["Carcharhinus leucas", "bull shark"],
    "Mako Shark": ["shortfin mako shark", "Isurus oxyrinchus"],
    "Manta Ray": ["reef manta ray", "Mobula alfredi"],
    "Grey Reef Shark": ["gray reef shark", "Carcharhinus amblyrhynchos"],
    "Caribbean Reef Shark": ["Caribbean reef shark", "Carcharhinus perezii"],
    "Blunt Nose Six Gill Shark": ["bluntnose sixgill shark", "Hexanchus griseus"],
    "Big Eyed Six Gill Shark": ["bigeyed sixgill shark", "Hexanchus nakamurai"],
    "Tasseled Wobbegong": ["tasselled wobbegong", "Eucrossorhinus dasypogon"],
    "Short-Tail Stingray": ["short-tail stingray", "Bathytoshia brevicaudata"],
    "Small-eye Pygmy Shark": ["smalleye pygmy shark", "Squaliolus aliae"],
    "Tail-light Shark": ["taillight shark", "Euprotomicroides zantedeschia"],
    "Dwarf Lanternshark": ["dwarf lantern shark", "Etmopterus perryi"],
    "Pygmy Lanternshark": ["Etmopterus fusus", "pygmy lantern shark"],
    "Bluegrey Carpetshark": ["bluegrey carpetshark", "Brachaelurus colcloughi"],
    "Japanese Bullhead Shark": ["Japanese bullhead shark", "Heterodontus japonicus"],
    "Narrow Sawfish": ["knifetooth sawfish", "Anoxypristis cuspidata"],
    "Broad Nose Seven Gill Shark": ["broadnose sevengill shark", "Notorynchus cepedianus"],
    "Sharp Nose Seven Gill Shark": ["sharpnose sevengill shark", "Heptranchias perlo"],
    "Southern African Frilled Shark": ["southern African frilled shark", "Chlamydoselachus africana"],
    "Bigeye Sand Tiger Shark": ["bigeye sand tiger", "Odontaspis noronhai"],
    "Fine-Spotted Leopard Whipray": ["reticulate whipray", "Himantura tutul"],
    "Cowtail Stingray": ["cowtail stingray", "Pastinachus sephen"],
    "Whitespotted Eagle Ray": ["white-spotted eagle ray", "Aetobatus narinari"],
    "Scoophead Shark": ["scoophead", "Sphyrna media"],
    "Winghead Shark": ["winghead shark", "Eusphyra blochii"],
    "Bonnethead Shark": ["bonnethead", "Sphyrna tiburo"],
    "Scalloped Bonnethead": ["scalloped bonnethead", "Sphyrna corona"],
    "Whitefin Hammerhead": ["whitefin hammerhead", "Sphyrna couardi"],
    "Carolina Hammerhead": ["Carolina hammerhead", "Sphyrna gilberti"],
}

MANUAL_IMAGE_URLS = {
    "Pygmy Lanternshark": "https://fishesofaustralia.net.au/images/image/EtmopterusFususCSIRO.jpg",
    "Whitefin Hammerhead": "https://inaturalist-open-data.s3.amazonaws.com/photos/95757177/medium.gif",
}

EXPECTED_SCIENTIFIC = {
    "Whale Shark": "Rhincodon typus",
    "Tiger Shark": "Galeocerdo cuvier",
    "Bull Shark": "Carcharhinus leucas",
    "Basking Shark": "Cetorhinus maximus",
    "Nurse Shark": "Ginglymostoma cirratum",
    "Lemon Shark": "Negaprion brevirostris",
    "Blacktip Reef Shark": "Carcharhinus melanopterus",
    "Whitetip Reef Shark": "Triaenodon obesus",
    "Galapagos Shark": "Carcharhinus galapagensis",
    "Zebra Shark": "Stegostoma tigrinum",
    "Tawny Nurse Shark": "Nebrius ferrugineus",
    "Blue Shark": "Prionace glauca",
    "Oceanic Whitetip Shark": "Carcharhinus longimanus",
    "Silky Shark": "Carcharhinus falciformis",
    "Dusky Shark": "Carcharhinus obscurus",
    "Spinner Shark": "Carcharhinus brevipinna",
    "Sandbar Shark": "Carcharhinus plumbeus",
    "Goblin Shark": "Mitsukurina owstoni",
    "Frilled Shark": "Chlamydoselachus anguineus",
    "Cookiecutter Shark": "Isistius brasiliensis",
    "Megamouth Shark": "Megachasma pelagios",
    "Bramble Shark": "Echinorhinus brucus",
    "Prickly Shark": "Echinorhinus cookei",
    "Pocket Shark": "Mollisquama parini",
    "Ninja Lanternshark": "Etmopterus benchleyi",
}

REMBG_SESSION = new_session("isnet-general-use") if new_session else None


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def http_bytes(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def slugify(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def get_event_cards():
    text = SCRIPT.read_text(encoding="utf-8")
    start = text.index("const LOST_TREASURES_CATEGORIES")
    end = text.index("const LOST_TREASURES_CARDS_PER_CATEGORY", start)
    block = text[start:end]
    categories = []
    pattern = re.compile(r'\{\s*id:\s*"([^"]+)".*?name:\s*"([^"]+)".*?species:\s*\[([^\]]+)\]', re.S)
    for category_id, category_name, species_block in pattern.findall(block):
        species = re.findall(r'"([^"]+)"', species_block)
        for index, name in enumerate(species, start=1):
            categories.append({
                "id": f"{category_id}-{index:02d}",
                "categoryId": category_id,
                "categoryName": category_name,
                "number": index,
                "name": name,
                "rarity": "rare" if index >= 9 else "common",
            })
    return categories


def search_inaturalist(name):
    queries = []
    if name in EXPECTED_SCIENTIFIC:
        queries.append(EXPECTED_SCIENTIFIC[name])
    queries.extend(ALIASES.get(name, [name]))
    for query in queries:
        url = "https://api.inaturalist.org/v1/taxa?q={}&per_page=10".format(urllib.parse.quote(query))
        try:
            data = http_json(url)
        except Exception:
            time.sleep(1.2)
            continue
        results = data.get("results", [])
        best = None
        normalized_name = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
        expected_scientific = EXPECTED_SCIENTIFIC.get(name, "").lower()
        for taxon in results:
            haystack = " ".join([
                taxon.get("preferred_common_name") or "",
                taxon.get("english_common_name") or "",
                taxon.get("name") or "",
                taxon.get("matched_term") or "",
            ]).lower()
            is_ray_or_shark = re.search(r"shark|ray|sawfish|guitarfish|wobbegong|stingray|lanternshark|angelshark|hammerhead|mako|porbeagle|bonnethead", haystack)
            has_photo = bool((taxon.get("default_photo") or {}).get("medium_url") or (taxon.get("default_photo") or {}).get("url"))
            rank = taxon.get("rank") or ""
            exact_scientific = expected_scientific and (taxon.get("name") or "").lower() == expected_scientific
            acceptable_rank = rank in {"species", "subspecies", "complex", "genus"} or exact_scientific
            exact_common = normalized_name in haystack or query.lower() in haystack
            if has_photo and acceptable_rank and (exact_scientific or exact_common or is_ray_or_shark):
                best = taxon
                break
        if best:
            photo = best.get("default_photo") or {}
            observation_photo = find_observation_photo(best.get("id"))
            return {
                "source": "iNaturalist",
                "query": query,
                "matched": best.get("preferred_common_name") or best.get("english_common_name") or best.get("name"),
                "scientificName": best.get("name"),
                "taxonId": best.get("id"),
                "sourceUrl": f"https://www.inaturalist.org/taxa/{best.get('id')}",
                "imageUrl": observation_photo or photo.get("large_url") or photo.get("medium_url") or photo.get("url"),
            }
        time.sleep(0.35)
    return None


def find_observation_photo(taxon_id):
    if not taxon_id:
        return ""
    url = "https://api.inaturalist.org/v1/observations?taxon_id={}&photos=true&quality_grade=research&per_page=12&order_by=votes".format(taxon_id)
    try:
        data = http_json(url)
    except Exception:
        return ""
    for observation in data.get("results", []):
        for photo in observation.get("photos", []):
            raw = photo.get("url") or ""
            if raw:
                return raw.replace("square.", "large.").replace("medium.", "large.")
    return ""


def search_wikipedia(name):
    queries = ALIASES.get(name, [name])
    for query in queries:
        title = query.replace(" ", "_")
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
        try:
            data = http_json(url)
        except Exception:
            time.sleep(0.8)
            continue
        image = (data.get("originalimage") or {}).get("source") or (data.get("thumbnail") or {}).get("source")
        if image:
            return {
                "source": "Wikipedia",
                "query": query,
                "matched": data.get("title"),
                "scientificName": "",
                "sourceUrl": ((data.get("content_urls") or {}).get("desktop") or {}).get("page", ""),
                "imageUrl": image,
            }
        time.sleep(0.25)
    return None


def find_image(card):
    if card["name"] in MANUAL_IMAGE_URLS:
        return {
            "source": "manual",
            "query": card["name"],
            "matched": card["name"],
            "scientificName": "",
            "sourceUrl": MANUAL_IMAGE_URLS[card["name"]],
            "imageUrl": MANUAL_IMAGE_URLS[card["name"]],
        }
    return search_inaturalist(card["name"]) or search_wikipedia(card["name"])


def remove_photo_background(image):
    rgb = ImageOps.exif_transpose(image).convert("RGB")
    if rembg_remove and REMBG_SESSION:
        source = rgb.copy()
        source.thumbnail((640, 480), Image.Resampling.LANCZOS)
        cutout = rembg_remove(source, session=REMBG_SESSION).convert("RGBA")
        bbox = cutout.getchannel("A").point(lambda p: 255 if p > 12 else 0).getbbox()
        if bbox:
            return cutout.crop(bbox)
    rgb.thumbnail((520, 360), Image.Resampling.LANCZOS)
    arr = np.asarray(rgb).astype(np.int16)
    height, width = arr.shape[:2]
    border = np.concatenate([arr[:8, :, :].reshape(-1, 3), arr[-8:, :, :].reshape(-1, 3), arr[:, :8, :].reshape(-1, 3), arr[:, -8:, :].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    distance = np.sqrt(((arr - bg) ** 2).sum(axis=2))
    threshold = max(42, min(118, float(np.percentile(distance, 78)) * 0.92))
    background_candidate = distance < threshold
    visited = np.zeros((height, width), dtype=bool)
    stack = []
    for x in range(width):
        stack.append((0, x))
        stack.append((height - 1, x))
    for y in range(height):
        stack.append((y, 0))
        stack.append((y, width - 1))
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= height or x >= width or visited[y, x] or not background_candidate[y, x]:
            continue
        visited[y, x] = True
        stack.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))

    subject = ~visited
    alpha = (subject.astype(np.uint8) * 255)
    mask = Image.fromarray(alpha, "L")
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    cutout = rgb.convert("RGBA")
    cutout.putalpha(mask)
    bbox = mask.point(lambda p: 255 if p > 24 else 0).getbbox()
    if bbox:
        cutout = cutout.crop(bbox)
    return cutout


def make_card(card, source_path=None, cutout=None):
    template = Image.open(RARE_TEMPLATE if card["rarity"] == "rare" else CARD_TEMPLATE).convert("RGBA")
    canvas = template.copy()
    if cutout is None:
        species = Image.open(source_path)
        cutout = remove_photo_background(species)
    cutout.thumbnail((386, 238), Image.Resampling.LANCZOS)
    shadow_alpha = cutout.getchannel("A").filter(ImageFilter.GaussianBlur(5)).point(lambda p: int(p * 0.36))
    shadow = Image.new("RGBA", cutout.size, (0, 0, 0, 0))
    shadow.putalpha(shadow_alpha)
    x = (500 - cutout.width) // 2
    y = 138 + (170 - cutout.height) // 2
    canvas.alpha_composite(shadow, (x + 6, y + 10))
    canvas.alpha_composite(cutout, (x, y))
    return canvas


def save_species_cutout(source_path, out_path):
    species = Image.open(source_path)
    cutout = remove_photo_background(species)
    final_cutout = cutout.copy()
    final_cutout.thumbnail((900, 620), Image.Resampling.LANCZOS)
    padded = Image.new("RGBA", (900, 620), (0, 0, 0, 0))
    padded.alpha_composite(final_cutout, ((900 - final_cutout.width) // 2, (620 - final_cutout.height) // 2))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    padded.save(out_path)
    return cutout


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    CUTOUT_DIR.mkdir(parents=True, exist_ok=True)
    cards = get_event_cards()
    manifest = []
    for card in cards:
        out_path = OUT_DIR / f"{card['id']}.png"
        source_path = SOURCE_DIR / f"{card['id']}-{slugify(card['name'])}.jpg"
        image_meta = find_image(card)
        if not image_meta or not image_meta.get("imageUrl"):
            raise RuntimeError(f"No online image found for {card['name']}")
        source_path.write_bytes(http_bytes(image_meta["imageUrl"]))
        cutout_path = CUTOUT_DIR / f"{card['id']}-{slugify(card['name'])}.png"
        cutout = save_species_cutout(source_path, cutout_path)
        final = make_card(card, cutout=cutout)
        final.save(out_path)
        manifest.append({**card, **image_meta, "cardImage": str(out_path.relative_to(ROOT)).replace("\\", "/"), "sourceImage": str(source_path.relative_to(ROOT)).replace("\\", "/"), "cutoutImage": str(cutout_path.relative_to(ROOT)).replace("\\", "/")})
        print(f"{len(manifest):03d}/120 {card['name']} -> {out_path.name}")
        time.sleep(0.25)
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {MANIFEST}")


if __name__ == "__main__":
    main()
