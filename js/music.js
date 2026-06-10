
/**

音乐理论工具模块

音符频率映射、音高检测辅助
*/

const Music = (() => {
// 标准音符名称
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// 中文音名映射
const NOTE_NAMES_CN = {
    'C': 'Do', 'D': 'Re', 'E': 'Mi', 'F': 'Fa',
    'G': 'Sol', 'A': 'La', 'B': 'Si',
    'C#': 'Do#', 'D#': 'Re#', 'F#': 'Fa#', 'G#': 'Sol#', 'A#': 'La#'
};

// A4 = 440Hz 为基准
const A4_FREQ = 440;
const A4_MIDI = 69;

/**
 * MIDI音符号转频率
 */
function midiToFreq(midi) {
    return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * 频率转MIDI音符号
 */
function freqToMidi(freq) {
    if (freq <= 0) return -1;
    return Math.round(12 * Math.log2(freq / A4_FREQ) + A4_MIDI);
}

/**
 * 频率转音符名（如 C4, D#5）
 */
function freqToNoteName(freq) {
    if (freq <= 0) return '--';
    const midi = freqToMidi(freq);
    return midiToNoteName(midi);
}

/**
 * MIDI号转音符名
 */
function midiToNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return NOTE_NAMES[noteIndex] + octave;
}

/**
 * 音符名转MIDI号
 */
function noteNameToMidi(name) {
    const match = name.match(/^([A-G]#?)(\d)$/);
    if (!match) return -1;
    const note = match[1];
    const octave = parseInt(match[2]);
    const noteIndex = NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) return -1;
    return (octave + 1) * 12 + noteIndex;
}

/**
 * 获取中文音名
 */
function getChineseName(noteName) {
    const match = noteName.match(/^([A-G]#?)/);
    if (!match) return noteName;
    return NOTE_NAMES_CN[match[1]] || noteName;
}

/**
 * 计算两个音符之间的半音距离
 */
function semitoneDifference(midi1, midi2) {
    return Math.abs(midi1 - midi2);
}

/**
 * 判断两个频率是否为同一个音（允许一定偏差）
 */
function isSameNote(freq1, freq2, toleranceCents = 50) {
    if (freq1 <= 0 || freq2 <= 0) return false;
    const cents = 1200 * Math.log2(freq1 / freq2);
    return Math.abs(cents) <= toleranceCents;
}

/**
 * 判断检测到的MIDI号是否与期望匹配
 */
function isCorrectNote(detectedMidi, expectedMidi) {
    return detectedMidi === expectedMidi;
}

/**
 * 获取音符在钢琴键盘上的位置（0-87）
 */
function midiToPianoKey(midi) {
    return midi - 21; // 钢琴最低音 A0 = MIDI 21
}

return {
    NOTE_NAMES,
    NOTE_NAMES_CN,
    A4_FREQ,
    midiToFreq,
    freqToMidi,
    freqToNoteName,
    midiToNoteName,
    noteNameToMidi,
    getChineseName,
    semitoneDifference,
    isSameNote,
    isCorrectNote,
    midiToPianoKey
};
})();