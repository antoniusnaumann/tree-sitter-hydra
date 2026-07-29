// tour.hy — every construct the grammar knows, in one file.

use fmt
use json // http exports decode too, so json:: disambiguates

REGIONS := ["eu", "us", "ap"]
MASK := 255
CONFIG := { .region : "eu", ."x-req-id" : 17, .retries : .null }

fn warm(name, img, retries = 3, backoff = retries * 2)
	h := lease(name)
	::push(&h, img)
	if not healthy(h)
		drain(h)
		return .failed
	else if retries > 0
		return warm(name, img, retries = retries - 1)
	else
		if backoff > 0
			print("giving up on \(name) after \(backoff)")
		end
	end
	return h
end

fn bump(&box)
	box.count = box.count + 1
end

describe := fn(region, detail) "region \(region) (\(detail))"
short := fn(a, b) a + b

manifest := json::decode(read_file("deploy.json"))
img := manifest.image // same as manifest[.image]
tag := manifest."content-type"
key := ."\(img)-id"
mask := flags | MASK == 3 and not stale
bits := value >>> 2 << 1 ^ ~other

for name in REGIONS as scan
	if name == .failed
		continue scan
	end
	print("target \(name) -> \(img)", terminator = "")
end

while alive() as spin
	break spin
end

eu := .null
us := .null
ap := .null

parallel
	eu = warm("eu", img) || us = warm("us", img) || ap = warm("ap", img)
	smoke(eu)            || smoke(us)            || smoke(ap)
end

winner := .null
race as decided
	winner = "short" || slow := 1
	                 || slow = slow + 1
	                 ||
end

parallel
	if len(REGIONS) > 0 || for r in REGIONS
	go()                || ping(r)
	end                 || end
end

seen := []
parallel for region in REGIONS as fan
	push(&seen, region)
	if not alive()
		break trail
	end
end

race while has(CONFIG, .region)
	tick()
end

print("\(len(seen))/\(len(REGIONS)) regions live")
