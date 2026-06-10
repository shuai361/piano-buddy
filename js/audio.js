
/**

音频处理模块

负责麦克风采集和音高检测（YIN算法）
*/

const AudioEngine = (() => {
let audioContext = null;
let analyser = null;
let mediaStream = null;
let sourceNode = null;
let isListening = false;
let onNoteDetected = null;
let animFrameId = null;
// 音频参数
const FFT_SIZE = 2048;
const MIN_FREQ = 60;   // 钢琴最低音 ~27Hz，但实际从C2(65Hz)开始检测更稳定
const MAX_FREQ = 2000; // 钢琴最高音 ~4186Hz，但儿童曲目一般不超过C7

/**
 * 初始化音频上下文和麦克风
 */
async function init() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } 
        });

        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        sourceNode.connect(analyser);

        return true;
    } catch (err) {
        console.error('音频初始化失败:', err);
        return false;
    }
}

/**
 * 开始监听
 */
function startListening(callback) {
    if (!analyser) return false;
    onNoteDetected = callback;
    isListening = true;
    detectPitch();
    return true;
}

/**
 * 停止监听
 */
function stopListening() {
    isListening = false;
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

/**
 * 释放资源
 */
function destroy() {
    stopListening();
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
}

/**
 * 持续检测音高
 */
function detectPitch() {
    if (!isListening) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    // 计算RMS音量，静音则跳过
    const rms = Math.sqrt(buffer.reduce((sum, val) => sum + val * val, 0) / buffer.length);
    
    if (rms > 0.01) { // 音量阈值
        const freq = yinDetector(buffer, audioContext.sampleRate);
        if (freq > MIN_FREQ && freq < MAX_FREQ) {
            const midi = Music.freqToMidi(freq);
            const noteName = Music.midiToNoteName(midi);
            if (onNoteDetected) {
                onNoteDetected({
                    frequency: freq,
                    midi: midi,
                    noteName: noteName,
                    volume: rms,
                    timestamp: performance.now()
                });
            }
        }
    }

    animFrameId = requestAnimationFrame(detectPitch);
}

/**
 * YIN音高检测算法
 * 比简单的自相关更准确
 */
function yinDetector(buffer, sampleRate) {
    const bufferSize = buffer.length;
    const halfBuffer = Math.floor(bufferSize / 2);
    const yinBuffer = new Float32Array(halfBuffer);

    // Step 1: 差分函数
    for (let tau = 0; tau < halfBuffer; tau++) {
        let sum = 0;
        for (let i = 0; i < halfBuffer; i++) {
            const delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
        }
        yinBuffer[tau] = sum;
    }

    // Step 2: 累积均值归一化差分函数
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBuffer; tau++) {
        runningSum += yinBuffer[tau];
        yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
    }

    // Step 3: 绝对阈值法找周期
    const threshold = 0.15;
    let tauEstimate = -1;

    for (let tau = 2; tau < halfBuffer; tau++) {
        if (yinBuffer[tau] < threshold) {
            while (tau + 1 < halfBuffer && yinBuffer[tau + 1] < yinBuffer[tau]) {
                tau++;
            }
            tauEstimate = tau;
            break;
        }
    }

    if (tauEstimate === -1) return -1;

    // Step 4: 抛物线插值提高精度
    let betterTau;
    const x0 = tauEstimate - 1;
    const x2 = tauEstimate + 1;

    if (x0 >= 0 && x2 < halfBuffer) {
        const s0 = yinBuffer[x0];
        const s1 = yinBuffer[tauEstimate];
        const s2 = yinBuffer[x2];
        betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    } else {
        betterTau = tauEstimate;
    }

    return sampleRate / betterTau;
}

/**
 * 使用Web Audio API播放音符（用于示范）
 */
function playNote(midi, duration = 0.5) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = Music.midiToFreq(midi);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

/**
 * 播放整首曲子（示范）
 */
async function playSong(song) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const beatDuration = 60 / song.bpm;
    let time = audioContext.currentTime + 0.1;

    for (const noteData of song.notes) {
        const midi = Music.noteNameToMidi(noteData.note);
        const duration = noteData.duration * beatDuration;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // 使用更接近钢琴的音色
        oscillator.type = 'triangle';
        oscillator.frequency.value = Music.midiToFreq(midi);

        gainNode.gain.setValueAtTime(0.4, time);
        gainNode.gain.setValueAtTime(0.4, time + duration * 0.7);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.95);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start(time);
        oscillator.stop(time + duration);

        time += duration;
    }
    
    // 返回总时长
    const totalBeats = song.notes.reduce((sum, n) => sum + n.duration, 0);
    return totalBeats * beatDuration;
}

return {
    init,
    startListening,
    stopListening,
    destroy,
    playNote,
    playSong
};
})();
