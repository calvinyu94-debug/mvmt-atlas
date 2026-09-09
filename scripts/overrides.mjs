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

// MVMT muscle structures whose names do not match a BodyParts3D concept by token set, with the
// BP3D concept names that stand for them, so their depth (superficial / deep) reaches BP3D's
// muscles. Names are matched exactly after normalisation. A structure listed with an empty array
// is one BodyParts3D (as selected by Human Atlas) does not model at all; it is left unmatched and
// reported.
export const DEPTH_MATCHES={
 'Digastric, Anterior Belly':['digastric'],
 'Digastric, Posterior Belly':['digastric'],
 'Scalenes':['scalenus anterior','scalenus medius','scalenus posterior'],
 'Deep Neck Flexors':['longus capitis'],
 'Suboccipitals':['rectus capitis posterior major','rectus capitis posterior minor','obliquus capitis superior','obliquus capitis inferior'],
 'Upper Trapezius':['descending part of trapezius'],
 'Middle Trapezius':['transverse part of trapezius'],
 'Lower Trapezius':['ascending part of trapezius'],
 'Trapezius':['zone of trapezius'],
 'Deltoid':['zone of deltoid'],
 'Anterior Deltoid':['clavicular part of deltoid'],
 'Middle Deltoid':['acromial part of deltoid'],
 'Posterior Deltoid':['spinal part of deltoid'],
 'Pectoralis Major, Clavicular Head':['clavicular part of pectoralis major'],
 'Pectoralis Major, Sternocostal Head':['sternocostal part of pectoralis major','abdominal part of pectoralis major'],
 'Wrist Flexors':['flexor carpi radialis','palmaris longus','flexor digitorum superficialis'],
 'Flexor Digitorum Superficialis, Humero-ulnar Head':['flexor digitorum superficialis'],
 'Flexor Digitorum Superficialis, Radial Head':['flexor digitorum superficialis'],
 'Extensor Carpi Ulnaris, Humeral Head':['extensor carpi ulnaris'],
 'Extensor Carpi Ulnaris, Ulnar Head':['extensor carpi ulnaris'],
 'Thenar Group':['thenar muscle'],
 'Hypothenar Group':['hypothenar muscle'],
 'Intercostals':['intercostal muscle','external intercostal muscle','internal intercostal muscle','innermost intercostal muscle'],
 'Erector Spinae':['iliocostalis','longissimus','spinalis thoracis'],
 'Spinalis Cervicis':['spinalis thoracis'],
 'Interspinales':['set of interspinales lumborum','set of interspinales cervicis'],
 'Intertransversarii':['set of anterior cervical intertransversarii','set of posterior cervical intertransversarii'],
 'Deep External Rotators':['piriformis','obturator internus','obturator externus','quadratus femoris'],
 'Pelvic Floor':['coccygeus'],
 'Adductor Longus & Brevis':['adductor longus','adductor brevis'],
 'Quadriceps':['zone of quadriceps femoris'],
 'Vastus Medialis Oblique':['vastus medialis'],
 'Hamstrings':['semitendinosus','semimembranosus'],
 'Gastrocnemius':['medial head of gastrocnemius','lateral head of gastrocnemius'],
 'Fibularis Longus & Brevis':['fibularis longus','fibularis brevis'],
 'Sole, First Layer':['abductor hallucis','flexor digitorum brevis','abductor digiti minimi of foot'],
 'Sole, Second Layer':['lumbrical of foot'],
 'Sole, Third Layer':['flexor digiti minimi brevis of foot'],
 'Sole, Fourth Layer':['interosseous of foot'],
 'Intrinsic Foot Muscles':['abductor hallucis','flexor digitorum brevis','abductor digiti minimi of foot','lumbrical of foot','flexor digiti minimi brevis of foot','interosseous of foot'],
 // not modelled in BodyParts3D as selected by Human Atlas: nothing to match until the full release is audited (Phase 4A)
 'Masseter':[],'Masseter, Superficial Part':[],'Masseter, Deep Part':[],'Temporalis':[],'Medial Pterygoid':[],'Lateral Pterygoid':[],
 'Lateral Pterygoid, Superior Head':[],'Lateral Pterygoid, Inferior Head':[],'Occipitofrontalis':[],'Latissimus Dorsi':[],'Rhomboids':[],
 'Common Extensor Origin':[],'Common Flexor Origin':[],'Thoracic Multifidus':[],'Lumbar Multifidus':[],'Cervical Multifidus':[],'Multifidus':[],
 'Quadratus Lumborum':[],'Transversus Abdominis':[],'Obliques':[],'Internal Oblique':[],'Rectus Abdominis':[],'Psoas Minor':[],
 'Spinalis Capitis':[],'Transversospinalis Group':[],'Rotatores':[],'Hamstring Origin':[],'Extensor Digitorum Brevis':[],'Articularis Genus':[],
};
