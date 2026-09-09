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

// MVMT structures whose names do not match a BodyParts3D concept by token set, or match the wrong
// one, with the BP3D concept names that stand for them. build-index.mjs reads this twice: for the
// muscle depth (so a structure's superficial / deep reaches BP3D's muscles) and for the fascial
// lines (so a station lights BP3D's meshes for it, both sides). A name here is matched exactly
// after normalisation, an entry replaces the automatic match rather than adding to it, and the
// build stops if a name is not a concept of this atlas or a key is not a structure of
// mvmt-program's. A structure listed with an empty array is one BodyParts3D (as selected by Human
// Atlas) does not model at all; it is left unmatched and reported, and a fascial-line station on
// it lights only what our own layers hold for it.
export const CONCEPT_MATCHES={
 'Digastric, Anterior Belly':['digastric'],
 'Digastric, Posterior Belly':['digastric'],
 'Scalenes':['scalenus anterior','scalenus medius','scalenus posterior'],
 'Deep Neck Flexors':['longus capitis','zone of longus colli'],       // BP3D models longus colli on the left only
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
 'Thenar Group':['thenar muscle'],
 'Hypothenar Group':['hypothenar muscle'],
 // "intercostal muscle" is the parent of the external, internal and innermost layers; it holds all six meshes
 'Intercostals':['intercostal muscle'],
 'Erector Spinae':['iliocostalis','longissimus','spinalis'],
 'Spinalis Cervicis':['spinalis thoracis'],
 'Interspinales':['set of interspinales lumborum','set of interspinales cervicis'],
 'Intertransversarii':['set of anterior cervical intertransversarii','set of posterior cervical intertransversarii'],
 'Deep External Rotators':['piriformis','obturator internus','obturator externus','quadratus femoris'],
 'Pelvic Floor':['coccygeus','zone of levator ani'],
 'Adductor Longus & Brevis':['adductor longus','adductor brevis'],
 'Quadriceps':['zone of quadriceps femoris'],
 'Vastus Medialis Oblique':['vastus medialis'],
 'Hamstrings':['head of biceps femoris','semitendinosus','semimembranosus'],
 'Gastrocnemius':['medial head of gastrocnemius','lateral head of gastrocnemius'],
 'Fibularis Longus & Brevis':['fibularis longus','fibularis brevis'],
 'Sole, First Layer':['abductor hallucis','flexor digitorum brevis','abductor digiti minimi of foot'],
 'Sole, Second Layer':['lumbrical of foot'],
 'Sole, Third Layer':['flexor digiti minimi brevis of foot'],
 'Sole, Fourth Layer':['interosseous of foot'],
 'Intrinsic Foot Muscles':['abductor hallucis','flexor digitorum brevis','abductor digiti minimi of foot','lumbrical of foot','flexor digiti minimi brevis of foot','interosseous of foot'],
 // BP3D models both rhomboids, as sided concepts ("right rhomboid major"); the plural matched nothing
 'Rhomboids':['rhomboid major','rhomboid minor'],
 // fascial-line stations that are not muscles
 'Achilles Tendon':['calcaneal tendon'],
 'Iliotibial Band':['iliotibial tract'],
 // not modelled in BodyParts3D as selected by Human Atlas: nothing to match until the full release is audited (Phase 4A)
 'Masseter':[],'Masseter, Superficial Part':[],'Masseter, Deep Part':[],'Temporalis':[],'Medial Pterygoid':[],'Lateral Pterygoid':[],
 'Lateral Pterygoid, Superior Head':[],'Lateral Pterygoid, Inferior Head':[],'Occipitofrontalis':[],'Latissimus Dorsi':[],
 'Common Extensor Origin':[],'Common Flexor Origin':[],'Thoracic Multifidus':[],'Lumbar Multifidus':[],'Cervical Multifidus':[],'Multifidus':[],
 'Quadratus Lumborum':[],'Transversus Abdominis':[],'Obliques':[],'Internal Oblique':[],'Rectus Abdominis':[],'Psoas Minor':[],
 'Spinalis Capitis':[],'Transversospinalis Group':[],'Rotatores':[],'Hamstring Origin':[],'Extensor Digitorum Brevis':[],'Articularis Genus':[],
};
