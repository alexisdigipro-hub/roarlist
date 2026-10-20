// Greek and English; the app follows the system language.
import type { PrintLabels } from '../shared/api'

export const SIZES = ['ECU', 'CU', 'MCU', 'MS', 'MWS', 'WS', 'EWS', 'INS', 'OTS', 'POV', '2S']
export const ANGLES = ['eye', 'high', 'low', 'dutch', 'overhead', 'ground']
export const MOVES = ['static', 'pan', 'tilt', 'push', 'pull', 'dolly', 'track', 'handheld', 'steadicam', 'gimbal', 'crane', 'drone', 'zoom']
export const ASPECTS = ['16:9', '2.39:1', '1.85:1', '4:3', '1:1', '4:5', '9:16']

const el = {
  shotlists: 'Shot lists', newList: 'Νέο shot list', untitled: 'Χωρίς τίτλο', open: 'Άνοιγμα .roarlist',
  title: 'Τίτλος', client: 'Πελάτης', director: 'Σκηνοθέτης', dop: 'Δ/ντής φωτογραφίας', date: 'Ημέρα γυρίσματος', aspect: 'Κάδρο',
  notes: 'Σημειώσεις', projectNotes: 'Γενικές σημειώσεις για το γύρισμα',
  scene: 'Σκηνή', shot: 'Πλάνο', shots: 'Πλάνα', frame: 'Κάδρο', size: 'Μέγεθος', angle: 'Γωνία', move: 'Κίνηση', lens: 'Φακός',
  description: 'Περιγραφή', cast: 'Ηθοποιοί', duration: 'Διάρκεια', done: 'Γυρίστηκε', total: 'Σύνολο',
  heading: 'π.χ. ΕΣΩΤ. ΚΟΥΖΙΝΑ - ΝΥΧΤΑ', descPh: 'Τι βλέπουμε', addShot: 'Πλάνο', addScene: 'Σκηνή',
  list: 'Λίστα', board: 'Storyboard', export: 'Εξαγωγή', pdfList: 'PDF λίστα', pdfBoard: 'PDF storyboard', html: 'Ιστοσελίδα (.html)',
  file: 'Αρχείο .roarlist', fileHint: 'Για να το ανοίξει άλλος στο RoarList',
  duplicate: 'Αντίγραφο', remove: 'Διαγραφή', removeQ: 'Να πάει στον κάδο το shot list;', removeShotQ: 'Να διαγραφεί το πλάνο;', removeSceneQ: 'Να διαγραφεί η σκηνή με όλα τα πλάνα της;',
  copyOf: 'Αντίγραφο του', addImage: 'Βάλε εικόνα', dropImage: 'Σύρε, επικόλλησε ή διάλεξε εικόνα', removeImage: 'Αφαίρεση εικόνας', replaceImage: 'Αλλαγή εικόνας',
  moveUp: 'Πάνω', moveDown: 'Κάτω', drag: 'Σύρε για αλλαγή σειράς', saved: 'Αποθηκεύτηκε', exported: 'Έτοιμο', empty: 'Φτιάξε το πρώτο σου shot list',
  emptySub: 'Σκηνές, πλάνα, κάδρα και storyboard, και ένα PDF για το συνεργείο.', start: 'Ξεκίνα', updateReady: 'Νέα έκδοση έτοιμη', restart: 'Επανεκκίνηση',
  imgError: 'Αυτή η εικόνα δεν γίνεται δεκτή (PNG, JPG, WebP, GIF).', secs: 'δευτ.', undo: 'Αναίρεση', deleted: 'Διαγράφηκε', durHint: 'λλ:δδ ή δευτερόλεπτα',
  values: {
    eye: 'Ύψος ματιών', high: 'Από ψηλά', low: 'Από χαμηλά', dutch: 'Dutch', overhead: 'Κάτοψη', ground: 'Από το έδαφος',
    static: 'Σταθερό', pan: 'Pan', tilt: 'Tilt', push: 'Push in', pull: 'Pull out', dolly: 'Dolly', track: 'Tracking', handheld: 'Στο χέρι',
    steadicam: 'Steadicam', gimbal: 'Gimbal', crane: 'Γερανός', drone: 'Drone', zoom: 'Zoom',
  } as Record<string, string>,
}
const en: typeof el = {
  shotlists: 'Shot lists', newList: 'New shot list', untitled: 'Untitled', open: 'Open .roarlist',
  title: 'Title', client: 'Client', director: 'Director', dop: 'DoP', date: 'Shoot day', aspect: 'Aspect',
  notes: 'Notes', projectNotes: 'General notes for the shoot',
  scene: 'Scene', shot: 'Shot', shots: 'Shots', frame: 'Frame', size: 'Size', angle: 'Angle', move: 'Movement', lens: 'Lens',
  description: 'Description', cast: 'Cast', duration: 'Duration', done: 'Shot', total: 'Total',
  heading: 'e.g. INT. KITCHEN - NIGHT', descPh: 'What we see', addShot: 'Shot', addScene: 'Scene',
  list: 'List', board: 'Storyboard', export: 'Export', pdfList: 'PDF list', pdfBoard: 'PDF storyboard', html: 'Web page (.html)',
  file: '.roarlist file', fileHint: 'For someone else to open in RoarList',
  duplicate: 'Duplicate', remove: 'Delete', removeQ: 'Move this shot list to the trash?', removeShotQ: 'Delete this shot?', removeSceneQ: 'Delete this scene and all its shots?',
  copyOf: 'Copy of', addImage: 'Add image', dropImage: 'Drop, paste or choose an image', removeImage: 'Remove image', replaceImage: 'Replace image',
  moveUp: 'Up', moveDown: 'Down', drag: 'Drag to reorder', saved: 'Saved', exported: 'Done', empty: 'Make your first shot list',
  emptySub: 'Scenes, shots, frames and a storyboard, plus a PDF for the crew.', start: 'Start', updateReady: 'New version ready', restart: 'Restart',
  imgError: 'This image is not accepted (PNG, JPG, WebP, GIF).', secs: 'sec', undo: 'Undo', deleted: 'Deleted', durHint: 'mm:ss or seconds',
  values: {
    eye: 'Eye level', high: 'High', low: 'Low', dutch: 'Dutch', overhead: 'Overhead', ground: 'Ground',
    static: 'Static', pan: 'Pan', tilt: 'Tilt', push: 'Push in', pull: 'Pull out', dolly: 'Dolly', track: 'Tracking', handheld: 'Handheld',
    steadicam: 'Steadicam', gimbal: 'Gimbal', crane: 'Crane', drone: 'Drone', zoom: 'Zoom',
  },
}

export const lang = (navigator.language || 'en').toLowerCase().startsWith('el') ? 'el' : 'en'
export const t = lang === 'el' ? el : en
export const val = (k: string) => (k ? t.values[k] || k : '')

export const printLabels = (): PrintLabels => ({
  scene: t.scene, shot: t.shot, frame: t.frame, size: t.size, angle: t.angle, move: t.move, lens: t.lens, description: t.description,
  cast: t.cast, duration: t.duration, notes: t.notes, client: t.client, director: t.director, dop: t.dop, date: t.date,
  shots: t.shots, total: t.total, done: t.done, values: t.values,
})
