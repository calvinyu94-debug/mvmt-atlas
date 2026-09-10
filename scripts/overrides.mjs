// Hand-kept tables the model pipeline reads. Both are reviewed as descriptions: a name on the left,
// what it should be on the right, and a comment saying why.

// BodyParts3D files a few muscles and one fascia under its skeletal system. The audit (every
// skeletal part matched against a list of muscle and soft-tissue words) found these sixteen and
// nothing else. A part whose name matches goes to the system on the right before any region or
// chunk decision is made.
export const SYSTEM_OVERRIDES=[
 {match:/\b(levator scapulae|subscapularis|fibularis (brevis|longus|tertius)|tibialis (anterior|posterior))$/i,system:'muscular',why:'muscles filed as skeletal in BP3D'},
 {match:/\biliotibial tract$/i,system:'fascia',why:'a fascial band, filed as skeletal in BP3D; MVMT files it under fascia'},
];

// BP3D parts the landmark-distance assignment homes in the wrong region. BodyParts3D holds each
// intercostal layer as one mesh with no Z-Anatomy name to match, and its centroid, on the midline
// of the rib cage, is nearer the shoulder anchors (the acromia) than the thoracic ones; the same for
// the levatores costarum and the thoracic rotators. They are the thoracic wall and go there. Filed
// with the shoulder they reached the thoracic context as 4 MB of copies (the whole growth the
// section 4 audit was asked about, and then some). The internal intercostals matched by name.
export const REGION_OVERRIDES=[
 {match:/\b(intercostal muscle|levatores costarum (breves|longi)|thoracic rotator)$/i,region:'thoracic',why:'the thoracic wall, homed with the shoulder by landmark distance'},
];

// Which MVMT regions touch, as mvmt-anatomy's tools/regions.py has it. A region's context is drawn
// from these: a part whose home is a neighbour and that reaches into the region.
export const NEIGHBOURS={
 'head-jaw':['cervical'],
 'cervical':['head-jaw','shoulder','thoracic'],
 'shoulder':['cervical','thoracic','elbow-wrist'],
 'elbow-wrist':['shoulder'],
 'thoracic':['cervical','shoulder','lumbar'],
 'lumbar':['thoracic','hip'],
 'hip':['lumbar','knee'],
 'knee':['hip','ankle-foot'],
 'ankle-foot':['knee'],
};

// MVMT structures whose names do not match a BodyParts3D concept by token set, or match the wrong
// one, with the BP3D concept names that stand for them. build-index.mjs reads this three times: for
// the muscle depth (so a structure's superficial / deep reaches BP3D's muscles), for the fascial
// lines (so a station lights BP3D's meshes for it, both sides), and for the id bridge (so a click
// on a BP3D part resolves to the MVMT structure it belongs to and that structure's drills can be
// offered from the atlas). A name here is matched exactly
// after normalisation, an entry replaces the automatic match rather than adding to it, and the
// build stops if a name is not a concept of this atlas or a key is not a structure of
// mvmt-program's. A structure listed with an empty array is one BodyParts3D (as selected by Human
// Atlas) does not model at all; it is left unmatched and reported, and a fascial-line station on
// it lights only what our own layers hold for it.
export const CONCEPT_MATCHES={
 'Digastric, Anterior Belly':['digastric'],
 'Digastric, Posterior Belly':['digastric'],
 'Scalenes':['scalenus anterior','scalenus medius','scalenus posterior'],
 // BP3D models longus colli on the left only; the two small prevertebral recti are the rest of the group
 'Deep Neck Flexors':['longus capitis','zone of longus colli','rectus capitis anterior','rectus capitis lateralis'],
 'Suboccipitals':['rectus capitis posterior major','rectus capitis posterior minor','obliquus capitis superior','obliquus capitis inferior'],
 'Upper Trapezius':['descending part of trapezius'],
 'Middle Trapezius':['transverse part of trapezius'],
 'Lower Trapezius':['ascending part of trapezius'],
 // "zone of trapezius" holds the transverse part alone; the whole muscle is its three parts
 'Trapezius':['descending part of trapezius','transverse part of trapezius','ascending part of trapezius'],
 'Deltoid':['zone of deltoid'],
 'Anterior Deltoid':['clavicular part of deltoid'],
 'Middle Deltoid':['acromial part of deltoid'],
 'Posterior Deltoid':['spinal part of deltoid'],
 // the exact match, "right / left pectoralis major", carries the sternocostal and abdominal parts and not the clavicular
 'Pectoralis Major':['clavicular part of pectoralis major','sternocostal part of pectoralis major','abdominal part of pectoralis major'],
 'Pectoralis Major, Clavicular Head':['clavicular part of pectoralis major'],
 'Pectoralis Major, Sternocostal Head':['sternocostal part of pectoralis major','abdominal part of pectoralis major'],
 // BP3D has no "flexor carpi ulnaris" concept, only its two heads
 'Wrist Flexors':['flexor carpi radialis','palmaris longus','flexor digitorum superficialis','humeral head of flexor carpi ulnaris','ulnar head of flexor carpi ulnaris'],
 'Flexor Digitorum Superficialis, Humero-ulnar Head':['flexor digitorum superficialis'],
 'Flexor Digitorum Superficialis, Radial Head':['flexor digitorum superficialis'],
 'Extensor Carpi Ulnaris, Humeral Head':['extensor carpi ulnaris'],
 'Extensor Carpi Ulnaris, Ulnar Head':['extensor carpi ulnaris'],
 'Thenar Group':['thenar muscle','superficial head of flexor pollicis brevis'],   // the superficial head is a BP3D part outside "thenar muscle"
 'Hypothenar Group':['hypothenar muscle'],
 // "intercostal muscle" is the parent of the external, internal and innermost layers; it holds all six meshes
 'Intercostals':['intercostal muscle'],
 'Erector Spinae':['iliocostalis','longissimus','spinalis'],
 'Spinalis Cervicis':['spinalis thoracis'],
 'Interspinales':['set of interspinales lumborum','set of interspinales cervicis','interspinalis thoracis'],
 'Intertransversarii':['set of anterior cervical intertransversarii','set of posterior cervical intertransversarii','lumbar intertransversarius'],
 'Deep External Rotators':['piriformis','obturator internus','obturator externus','quadratus femoris'],
 'Pelvic Floor':['coccygeus','zone of levator ani','tendinous arch of levator ani'],
 'Adductor Longus & Brevis':['adductor longus','adductor brevis'],
 'Quadriceps':['zone of quadriceps femoris'],
 'Vastus Medialis Oblique':['vastus medialis'],
 'Hamstrings':['head of biceps femoris','semitendinosus','semimembranosus'],
 'Gastrocnemius':['medial head of gastrocnemius','lateral head of gastrocnemius'],
 'Fibularis Longus & Brevis':['fibularis longus','fibularis brevis'],
 'Sole, First Layer':['abductor hallucis','flexor digitorum brevis','abductor digiti minimi of foot'],
 'Sole, Second Layer':['lumbrical of foot','flexor accessorius'],                 // quadratus plantae, under BP3D's other name for it
 'Sole, Third Layer':['flexor digiti minimi brevis of foot','head of flexor hallucis brevis','head of adductor hallucis','opponens digiti minimi of foot'],
 'Sole, Fourth Layer':['interosseous of foot'],
 'Intrinsic Foot Muscles':['abductor hallucis','flexor digitorum brevis','abductor digiti minimi of foot','lumbrical of foot','flexor accessorius','flexor digiti minimi brevis of foot','head of flexor hallucis brevis','head of adductor hallucis','opponens digiti minimi of foot','interosseous of foot'],
 // BP3D models both rhomboids, as sided concepts ("right rhomboid major"); the plural matched nothing
 'Rhomboids':['rhomboid major','rhomboid minor'],
 // fascial-line stations that are not muscles
 'Achilles Tendon':['calcaneal tendon'],
 'Iliotibial Band':['iliotibial tract'],
 // groups whose members BP3D has under other names (the section 3 search of BP3D's part names: "rotator" for the rotatores)
 'Rotatores':['rotator muscle'],
 'Transversospinalis Group':['semispinalis','rotator muscle'],          // plus the multifidus carried from Z-Anatomy
 'Hamstring Origin':['semitendinosus','semimembranosus','long head of biceps femoris'],
 'Obliques':['external oblique'],                                        // plus the internal oblique carried from Z-Anatomy
 // not modelled in BodyParts3D as selected by Human Atlas (the section 3 search found no part of the name). The muscle
 // itself is carried across from Z-Anatomy by mvmt-anatomy's CARRIED_MUSCLES and reaches its structure as our own
 // exported mesh, so depth and the fascial lines get it that way; nothing here to match.
 'Masseter':[],'Masseter, Superficial Part':[],'Masseter, Deep Part':[],'Temporalis':[],'Medial Pterygoid':[],'Lateral Pterygoid':[],
 'Lateral Pterygoid, Superior Head':[],'Lateral Pterygoid, Inferior Head':[],'Occipitofrontalis':[],'Latissimus Dorsi':[],
 'Thoracic Multifidus':[],'Lumbar Multifidus':[],'Cervical Multifidus':[],'Multifidus':[],
 'Quadratus Lumborum':[],'Transversus Abdominis':[],'Internal Oblique':[],'Rectus Abdominis':[],
 'Spinalis Capitis':[],
 // BP3D has no extensor digitorum brevis, but it names the medial slip of the same muscle mass on its own; the belly is
 // still carried from Z-Anatomy, so this is the one carried muscle that also matches a BP3D part
 'Extensor Digitorum Brevis':['extensor hallucis brevis'],
 // not modelled in BodyParts3D and nothing to carry: Z-Anatomy has no belly for these either (attachment sites, or absent)
 'Common Extensor Origin':[],'Common Flexor Origin':[],'Psoas Minor':[],'Articularis Genus':[],
 // ---- the id bridge. MVMT files most bones as groups where BP3D names each bone, so the groups are spelled out; the
 // bones named one to one (femur, scapula, hip bone, patella ...) match on their own. BP3D has no coccyx.
 'Cranium':['neurocranium','sphenoid bone','maxilla','zygomatic bone','nasal bone','palatine bone','vomer'],   // "skull" would bring the teeth and gingivae with it
 'Cervical Vertebrae':['set of cervical vertebrae'],
 'Thoracic Vertebrae':['set of thoracic vertebrae'],
 'Cervical Discs':['intervertebral disk of cervical vertebra'],
 'Lumbar Discs':['intervertebral disk of lumbar vertebra'],
 'Ribs':['rib'],
 'Costal Cartilages':['costal cartilage'],
 'Sacrum and Coccyx':['sacrum'],
 'Carpal Bones':['carpal bone'],
 'Metacarpals and Phalanges':['metacarpal bone','phalanx of finger'],
 'Tarsal Bones':['tarsal bone'],
 'Metatarsals and Phalanges':['metatarsal bone','phalanx of toe','sesamoid bone of foot'],
 'Lumbar Vertebrae':['set of lumbar vertebrae'],                              // the parts (First Lumbar Vertebra ...) match on their own
 'Thoracic Discs':['intervertebral disk of thoracic vertebra'],              // T1-T2 to T11-T12; the T12-L1 disc is in PART_MATCHES below
 'Interosseous Membrane':['interosseous membrane of forearm'],   // the token match took the forearm's and the leg's alike; the leg's is its own structure
 'Adductor Magnus':['adductor magnus','adductor minimus'],   // adductor minimus is the upper part of magnus, a BP3D part of its own
 'Digastric':['digastric','intermediate tendon'],           // the tendon between the bellies is a BP3D part of its own
};

// BP3D parts that stand for a structure but cannot be named by concept: their own concept is a parent
// that holds other parts too. Keyed by structure name like CONCEPT_MATCHES, listing BP3D part ids;
// these add to the structure's parts rather than replacing its concept match. The build stops on a
// part id the atlas lacks.
export const PART_MATCHES={
 // BP3D's one unnamed disc, "Intervertebral disk" (concept FMA10446, the parent of all 23), sits between T12 and L1
 // by its bounds: it is the T12-L1 disc, and the thoracic discs end there
 'Thoracic Discs':['FJ3211'],
};

// Structures with no geometry in this atlas at all - no BP3D concept, no carried mesh - and why. Every
// structure the bridge leaves without parts must be listed here with a reason, and a listed structure
// that gains geometry must be taken out: the build stops on either, so the coverage table's "no
// geometry" list is always a reviewed one and never a silent gap. Reviewed 2026-09-10 against every
// BP3D concept name (nerves, canals, sheaths, retinacula, bursae, joints, the two muscles): none of
// these has a BodyParts3D counterpart, as selected by Human Atlas.
const NO_JOINTS='joints are not parts in BodyParts3D; the bones on either side are, and are mapped';
const NO_BURSAE='BodyParts3D has no bursae';
const A_SPACE='a space between structures BodyParts3D has, with no wall of its own to draw';
const TEXT_ONLY_NERVE="BodyParts3D's nerves are cranial and orbital; this is one of the nineteen peripheral nerves that are text-only by design (the ten with geometry are our schematic nerves)";
export const ABSENT_STRUCTURES={
 'cervical-facets':NO_JOINTS,'thoracic-facets':NO_JOINTS,'lumbar-facets':NO_JOINTS,
 'joint-atlanto-occipital':NO_JOINTS,'joint-atlantoaxial':NO_JOINTS,'joint-uncovertebral':NO_JOINTS,'joint-sternocostal':NO_JOINTS,
 'shoulder-scapulothoracic':'not a synovial joint: a gliding plane between the scapula and the rib cage, both of which are mapped',
 'thoracic-tl-junction':'a region of the column rather than a part: T12, L1 and the disc between them each resolve to their own structure',
 'shoulder-scapulothoracic-bursa':NO_BURSAE,'ankle-retrocalcaneal-bursa':NO_BURSAE,
 'elbow-wrist-guyons-canal':A_SPACE,'elbow-wrist-cubital-tunnel':A_SPACE,'hip-adductor-canal':A_SPACE,
 'lumbar-rectus-sheath':'BodyParts3D has no abdominal fascia; the sheath is the aponeuroses of the obliques, which it does not model apart from the muscles',
 'knee-patellar-retinacula':'BodyParts3D has no retinacula at the knee (its only retinaculum is at the wrist, mapped to Flexor Retinaculum)',
 'lumbar-psoas-minor':'not modelled in BodyParts3D as selected by Human Atlas, and Z-Anatomy has no belly for it either (Articularis Genus, the other such muscle, reaches the atlas through its carried attachment patches)',
 'nerve-spinal-accessory':TEXT_ONLY_NERVE,'nerve-greater-occipital':TEXT_ONLY_NERVE,'nerve-phrenic':TEXT_ONLY_NERVE,'nerve-facial':TEXT_ONLY_NERVE,
 'nerve-dorsal-scapular':TEXT_ONLY_NERVE,'nerve-long-thoracic':TEXT_ONLY_NERVE,'nerve-suprascapular':TEXT_ONLY_NERVE,'nerve-axillary':TEXT_ONLY_NERVE,
 'nerve-musculocutaneous':TEXT_ONLY_NERVE,'nerve-thoracodorsal':TEXT_ONLY_NERVE,'nerve-pectoral':TEXT_ONLY_NERVE,'nerve-intercostal':TEXT_ONLY_NERVE,
 'nerve-superior-cluneal':TEXT_ONLY_NERVE,'nerve-obturator':TEXT_ONLY_NERVE,'nerve-superior-gluteal':TEXT_ONLY_NERVE,'nerve-inferior-gluteal':TEXT_ONLY_NERVE,
 'nerve-lat-fem-cutaneous':TEXT_ONLY_NERVE,'nerve-saphenous':TEXT_ONLY_NERVE,
};
