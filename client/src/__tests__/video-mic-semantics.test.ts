import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const VCP = path.resolve(__dirname, "../../public/video-capture.js");

describe("Video mic semantics: executable behavior, not regex-only", () => {
  const src = () => fs.readFileSync(VCJS, "utf8");

  it("source invariants: display capture video-only, mic via getUserMedia, never camera", () => {
    const s = src();
    expect(s).toMatch(/audio\s*:\s*false/);
    expect(s).not.toMatch(/getDisplayMedia\([^)]*audio\s*:\s*mic/);
    expect(s).not.toMatch(/hasAudio/);
    expect(s).toMatch(/getUserMedia\s*\(\s*\{\s*audio\s*:\s*true\s*,\s*video\s*:\s*false/);
    expect(s).not.toMatch(/getUserMedia\(\{[^}]*video\s*:\s*true/);
  });

  it("mirror byte-identical", () => {
    expect(fs.readFileSync(VCJS).equals(fs.readFileSync(VCP))).toBe(true);
  });

  describe("behavior: getDisplayMedia always video-only; mic branch semantics", () => {
    function makeTrack(kind: string, id: string){
      return { kind, id, stop: vi.fn(), addEventListener: vi.fn(), label: id } as any;
    }
    function makeStream(){ const tracks:any[]=[]; return { getTracks:()=>tracks.slice(), getAudioTracks:()=>tracks.filter((t:any)=>t.kind==='audio'), getVideoTracks:()=>tracks.filter((t:any)=>t.kind==='video'), addTrack:(t:any)=>{tracks.push(t)}, _tracks:tracks } as any; }

    function setupEnv(opts: { gdmAudioTracks?: any[], micShouldFail?: {name:string}, micMissing?: boolean } = {}){
      const displayTrack = makeTrack('video','display-video');
      const displayStream = makeStream();
      (displayStream as any)._tracks.push(displayTrack);
      const gdmOptsCapture: any[] = [];
      const getDisplayMedia = vi.fn((o:any)=>{ gdmOptsCapture.push(o); if(opts.gdmAudioTracks){ for(const at of opts.gdmAudioTracks) (displayStream as any)._tracks.push(at); } return Promise.resolve(displayStream); });
      const micAudio = makeTrack('audio','mic-audio');
      const micStreamTracks = [micAudio];
      const getUserMedia = opts.micMissing ? undefined : vi.fn((o:any)=>{
        if(opts.micShouldFail) return Promise.reject(Object.assign(new Error('denied'), { name: opts.micShouldFail!.name }));
        return Promise.resolve({ getTracks:()=>micStreamTracks.slice(), getAudioTracks:()=>micStreamTracks.slice(), getVideoTracks:()=>[], addTrack: vi.fn() } as any);
      });
      const med: any = { getDisplayMedia };
      if(getUserMedia) med.getUserMedia = getUserMedia;
      const fakeNavigator: any = { mediaDevices: med };
      function MR(this:any, stream:any, o?:any){ this.stream=stream; this.mimeType=o?.mimeType||'video/webm;codecs=vp9,opus'; this.state='inactive'; this.ondataavailable=null as any; this.onstop=null as any; this.onerror=null as any; this.start=vi.fn(()=>{ this.state='recording'; }); this.stop=vi.fn(()=>{ this.state='inactive'; if(this.ondataavailable) this.ondataavailable({data: new Blob(['x'], {type:this.mimeType})}); if(this.onstop) this.onstop({}); }); }
      (MR as any).isTypeSupported = vi.fn((m:string)=> m.includes('webm'));
      const fakeURL: any = { createObjectURL: vi.fn(()=> "blob:fake-url"), revokeObjectURL: vi.fn(()=>{}) };
      const s = src();
      const win:any = {};
      const exec = new Function("window","navigator","MediaRecorder","Blob","File","URL","document", s + "\nreturn window.__bugaputaVideoCapture;");
      const cap = exec(win, fakeNavigator, MR as any, Blob, File, fakeURL, {} as any);
      return { cap, gdmOptsCapture, getDisplayMedia, getUserMedia, displayStream, displayTrack, micAudio, fakeURL, fakeNavigator };
    }

    async function flush(){ await new Promise(r=> setTimeout(r, 0)); await new Promise(r=> setTimeout(r, 0)); await new Promise(r=> setTimeout(r, 10)); }

    it("mic-off never calls getUserMedia and uses video-only display capture", async () => {
      const { cap, gdmOptsCapture, getUserMedia } = setupEnv();
      const denied = vi.fn(); const preview = vi.fn();
      cap.startSession({ micEnabled:false, onDenied:denied, onPreview:preview, onError:vi.fn(), onUnsupported:vi.fn() });
      await flush();
      expect(gdmOptsCapture.length).toBe(1);
      expect(gdmOptsCapture[0].audio).toBe(false);
      expect(gdmOptsCapture[0].video).toBeTruthy();
      if(getUserMedia) expect(getUserMedia).not.toHaveBeenCalled();
    });

    it("mic-on calls getUserMedia with audio:true video:false even when display stream carries system audio", async () => {
      const sysAudio = makeTrack('audio','system-audio');
      const { cap, gdmOptsCapture, getUserMedia, displayStream } = setupEnv({ gdmAudioTracks: [sysAudio] });
      const onDenied=vi.fn(), onPreview=vi.fn(), onError=vi.fn();
      cap.startSession({ micEnabled:true, onDenied, onPreview, onError, onUnsupported:vi.fn() });
      await flush();
      expect(gdmOptsCapture[0].audio).toBe(false);
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(getUserMedia).toHaveBeenCalledWith({audio:true, video:false});
      expect(displayStream.getAudioTracks().length).toBe(2);
      expect(displayStream.getAudioTracks().map((t:any)=>t.id)).toEqual(expect.arrayContaining(['system-audio','mic-audio']));
    });

    it("mic opt-in adds genuine mic track to recording stream", async () => {
      const { cap, displayStream } = setupEnv();
      cap.startSession({ micEnabled:true, onDenied:vi.fn(), onPreview:vi.fn(), onError:vi.fn(), onUnsupported:vi.fn() });
      await flush();
      expect(displayStream.getAudioTracks().some((t:any)=> t.id==='mic-audio')).toBe(true);
    });

    it("mic denial after display success stops all tracks, clears timers and shows recoverable denied state (no silent fallback)", async () => {
      const sysAudio2 = makeTrack('audio','system-audio-2');
      const { cap, displayStream, displayTrack } = setupEnv({ gdmAudioTracks:[sysAudio2], micShouldFail:{name:'NotAllowedError'} });
      const onDenied = vi.fn(); const onPreview = vi.fn(); const onError = vi.fn();
      cap.startSession({ micEnabled:true, onDenied, onPreview, onError, onUnsupported:vi.fn() });
      await flush();
      expect(onDenied).toHaveBeenCalledTimes(1);
      const msg = String(onDenied.mock.calls[0][0]);
      expect(msg).toMatch(/Microphone permission denied/i);
      expect(msg).toMatch(/continue without microphone/i);
      expect(onPreview).not.toHaveBeenCalled();
      expect(displayTrack.stop).toHaveBeenCalled();
      expect(sysAudio2.stop).toHaveBeenCalled();
    });

    it("camera is never requested", async () => {
      const { cap, getUserMedia } = setupEnv();
      cap.startSession({ micEnabled:true, onDenied:vi.fn(), onPreview:vi.fn(), onError:vi.fn(), onUnsupported:vi.fn() });
      await flush();
      if(getUserMedia) expect(getUserMedia).not.toHaveBeenCalledWith(expect.objectContaining({video:true}));
      const { cap: cap2, getUserMedia: gum2 } = setupEnv();
      cap2.startSession({ micEnabled:false, onDenied:vi.fn(), onPreview:vi.fn(), onError:vi.fn(), onUnsupported:vi.fn() });
      await new Promise(r=> setTimeout(r, 10));
      if(gum2) expect(gum2).not.toHaveBeenCalled();
    });
  });
});
