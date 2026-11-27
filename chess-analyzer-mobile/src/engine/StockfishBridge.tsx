import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { EvalData } from '../utils/moveClassifier';

export type EngineStatus = 'loading' | 'ready' | 'thinking' | 'idle' | 'error';

export interface StockfishHandle {
  /**
   * Analisa uma lista de posições em sequência (revisão da partida). A análise ao vivo fica
   * pausada enquanto isso. Resolve `false` se foi cancelada por outra revisão ou por `cancelReview`.
   */
  analyzePositions: (
    fens: string[],
    opts: { depth: number; movetimeMs: number },
    onResult: (index: number, data: EvalData) => void
  ) => Promise<boolean>;
  cancelReview: () => void;
}

interface StockfishBridgeProps {
  fen: string;
  depth?: number;
  multiPv?: number;
  hashMb?: number;
  onEvalUpdate: (data: EvalData, fen: string) => void;
  onStatusChange?: (status: EngineStatus, detail?: string) => void;
  /** Liga/desliga a análise ao vivo da posição atual (a revisão continua funcionando). */
  liveEnabled?: boolean;
}

interface SearchCtx {
  fen: string;
  latest: EvalData;
  onInfo?: (data: EvalData) => void;
  onDone?: (data: EvalData) => void;
  onAbort?: () => void;
}

const MIN_REPORT_DEPTH = 6;

const emptyEval = (): EvalData => ({ cp: 0, mate: null, bestMove: '', secondBestMove: '', depth: 0 });

/**
 * Ponte UCI com o Stockfish 19 (WASM, single-thread).
 *
 * - Web: Worker direto em /engine/stockfish.js (o .wasm é achado pelo próprio script).
 * - Android/iOS: WebView invisível que cria um Worker a partir de um Blob. Como um Worker
 *   em Blob não tem URL para buscar o .wasm, o bootstrap injeta os bytes do .wasm e
 *   substitui o `fetch` do Worker para entregá-los ao Stockfish.
 *
 * Cada `go` gera exatamente um `bestmove`. Contamos as buscas em aberto e descartamos
 * linhas `info` de buscas antigas (que chegam depois do `stop`).
 */
export const StockfishBridge = forwardRef<StockfishHandle, StockfishBridgeProps>(
  ({ fen, depth = 16, multiPv = 3, hashMb = 32, onEvalUpdate, onStatusChange, liveEnabled = true }, ref) => {
    const webViewRef = useRef<any>(null);
    const [webViewKey, setWebViewKey] = useState(0);
    const payloadRef = useRef<{ jsCode: string; wasmBase64: string } | null>(null);

    const sendRef = useRef<((cmds: string[]) => void) | null>(null);
    const readyRef = useRef(false);
    const readyWaitersRef = useRef<(() => void)[]>([]);
    const outstandingRef = useRef(0);
    const activeRef = useRef<SearchCtx | null>(null);
    const reviewIdRef = useRef(0);
    const reviewingRef = useRef(false);
    const uciOkRef = useRef(false);

    const currentFenRef = useRef(fen);
    currentFenRef.current = fen;
    const depthRef = useRef(depth);
    depthRef.current = depth;
    const liveEnabledRef = useRef(liveEnabled);
    liveEnabledRef.current = liveEnabled;

    const onEvalUpdateRef = useRef(onEvalUpdate);
    onEvalUpdateRef.current = onEvalUpdate;
    const onStatusChangeRef = useRef(onStatusChange);
    onStatusChangeRef.current = onStatusChange;

    const setStatus = (status: EngineStatus, detail?: string) =>
      onStatusChangeRef.current?.(status, detail);

    const runSearch = (ctx: SearchCtx, goCmd: string) => {
      const send = sendRef.current;
      if (!readyRef.current || !send) return false;

      const cmds: string[] = [];
      if (outstandingRef.current > 0) {
        cmds.push('stop');
        activeRef.current?.onAbort?.();
      }
      cmds.push(`position fen ${ctx.fen}`, goCmd);

      activeRef.current = ctx;
      outstandingRef.current += 1;
      send(cmds);
      setStatus('thinking');
      return true;
    };

    const startLive = (targetFen: string) => {
      if (reviewingRef.current || !liveEnabledRef.current) return;
      runSearch(
        {
          fen: targetFen,
          latest: emptyEval(),
          onInfo: (data) => onEvalUpdateRef.current(data, targetFen),
        },
        `go depth ${depthRef.current}`
      );
    };

    const waitReady = () =>
      readyRef.current
        ? Promise.resolve()
        : new Promise<void>((resolve) => readyWaitersRef.current.push(resolve));

    useImperativeHandle(ref, () => ({
      analyzePositions: async (fens, opts, onResult) => {
        const myId = ++reviewIdRef.current;
        await waitReady();
        if (myId !== reviewIdRef.current) return false;
        reviewingRef.current = true;
        let completed = true;

        try {
          for (let i = 0; i < fens.length; i++) {
            if (myId !== reviewIdRef.current) {
              completed = false;
              break;
            }
            const result = await new Promise<EvalData | null>((resolve) => {
              const ok = runSearch(
                {
                  fen: fens[i],
                  latest: emptyEval(),
                  onDone: (data) => resolve(data),
                  onAbort: () => resolve(null),
                },
                `go depth ${opts.depth} movetime ${opts.movetimeMs}`
              );
              if (!ok) resolve(null);
            });
            if (!result) {
              completed = false;
              break;
            }
            if (myId === reviewIdRef.current) onResult(i, result);
          }
        } finally {
          if (myId === reviewIdRef.current) {
            reviewingRef.current = false;
            startLive(currentFenRef.current);
          }
        }
        return completed;
      },
      cancelReview: () => {
        reviewIdRef.current += 1;
        if (reviewingRef.current) {
          reviewingRef.current = false;
          startLive(currentFenRef.current); // o stop aborta a busca da revisão
        }
      },
    }));

    const handleLine = (raw: string) => {
      const line = raw.trim();
      if (!line) return;

      if (line.startsWith('__sferror')) {
        const detail = line.slice(9).trim();
        console.warn('[Stockfish]', detail);
        setStatus('error', detail);
        return;
      }

      if (line.startsWith('__sfinfo')) {
        console.log('[Stockfish]', line.slice(8).trim());
        return;
      }

      if (line === 'uciok') {
        uciOkRef.current = true;
        sendRef.current?.([
          `setoption name Hash value ${hashMb}`,
          `setoption name MultiPV value ${multiPv}`,
          'isready',
        ]);
        return;
      }

      if (line === 'readyok') {
        if (!readyRef.current) {
          readyRef.current = true;
          setStatus('ready');
          readyWaitersRef.current.splice(0).forEach((r) => r());
          startLive(currentFenRef.current);
        }
        return;
      }

      if (line.startsWith('bestmove')) {
        outstandingRef.current = Math.max(0, outstandingRef.current - 1);
        if (outstandingRef.current === 0) {
          const ctx = activeRef.current;
          // Buscas muito curtas (ex.: um único lance legal) podem não ter linha "info" útil
          const bm = line.split(' ')[1];
          if (ctx && !ctx.latest.bestMove && bm && bm !== '(none)') ctx.latest = { ...ctx.latest, bestMove: bm };
          setStatus('idle');
          ctx?.onDone?.({ ...ctx.latest });
        }
        return;
      }

      // Só aceita linhas da busca mais recente
      if (outstandingRef.current !== 1 || !activeRef.current) return;
      parseInfo(line, activeRef.current);
    };

    const parseInfo = (line: string, ctx: SearchCtx) => {
      if (!line.startsWith('info') || !line.includes(' score ') || !line.includes(' pv ')) return;
      // Limites parciais (fail-high/low) são instáveis; esperamos o valor exato
      if (line.includes(' lowerbound') || line.includes(' upperbound')) return;

      const depthMatch = line.match(/ depth (\d+)/);
      const parsedDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
      const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (parsedDepth < MIN_REPORT_DEPTH || !pvMatch) return;

      const multipvMatch = line.match(/ multipv (\d+)/);
      const pvIndex = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
      const moveUci = pvMatch[1];

      // O score do UCI é do ponto de vista de quem joga na posição analisada
      const turnMultiplier = ctx.fen.split(' ')[1] === 'b' ? -1 : 1;
      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      let cp = 0;
      let mate: number | null = null;
      if (mateMatch) {
        mate = parseInt(mateMatch[1], 10) * turnMultiplier;
        cp = mate > 0 ? 10000 : -10000;
      } else if (cpMatch) {
        cp = parseInt(cpMatch[1], 10) * turnMultiplier;
      }

      const fullPv = line.match(/ pv ((?:[a-h][1-8][a-h][1-8][qrbn]? ?)+)/);
      const pvLine = {
        move: moveUci,
        cp,
        mate,
        line: fullPv ? fullPv[1].trim().split(' ').slice(0, 10) : [moveUci],
      };
      if (pvIndex === 1) {
        // Nova profundidade: as outras linhas da profundidade anterior deixam de valer
        const newDepth = parsedDepth > ctx.latest.depth;
        const pvs = newDepth ? [pvLine] : [pvLine, ...(ctx.latest.pvs ?? []).slice(1)];
        ctx.latest = {
          ...ctx.latest,
          cp,
          mate,
          bestMove: moveUci,
          secondBestMove: newDepth ? '' : ctx.latest.secondBestMove,
          secondCp: newDepth ? undefined : ctx.latest.secondCp,
          secondMate: newDepth ? undefined : ctx.latest.secondMate,
          pvs,
          depth: parsedDepth,
        };
      } else {
        const pvs = [...(ctx.latest.pvs ?? [])];
        if (pvs.length < pvIndex - 1) return; // linha fora de ordem (ainda sem as anteriores)
        pvs[pvIndex - 1] = pvLine;
        ctx.latest = {
          ...ctx.latest,
          pvs,
          ...(pvIndex === 2 ? { secondBestMove: moveUci, secondCp: cp, secondMate: mate } : {}),
        };
      }

      ctx.onInfo?.({ ...ctx.latest });
    };

    // 1. Navegador (Expo Web)
    useEffect(() => {
      if (Platform.OS !== 'web') return;

      setStatus('loading');
      const worker = new Worker('/engine/stockfish.js');
      worker.onmessage = (e) => {
        if (typeof e.data === 'string') handleLine(e.data);
      };
      worker.onerror = (e) => handleLine(`__sferror ${e.message ?? 'worker error'}`);
      sendRef.current = (cmds) => cmds.forEach((c) => worker.postMessage(c));
      worker.postMessage('uci');

      return () => {
        sendRef.current = null;
        readyRef.current = false;
        worker.terminate();
      };
    }, []);

    // 2. Android/iOS: lê os arquivos do motor; a página do WebView recebe tudo em partes
    useEffect(() => {
      if (Platform.OS === 'web') return;

      let cancelled = false;
      setStatus('loading');

      (async () => {
        try {
          const [jsCode, wasmBase64] = await Promise.all([
            readAsset(require('../../assets/engine/stockfish_engine.sfjs'), 'utf8'),
            readAsset(require('../../assets/engine/stockfish.wasm'), 'base64'),
          ]);
          if (cancelled) return;
          payloadRef.current = { jsCode, wasmBase64 };
          setWebViewKey((k) => k + 1); // monta o WebView
        } catch (err) {
          if (!cancelled) handleLine(`__sferror Não foi possível ler os arquivos do motor: ${String(err)}`);
        }
      })();

      return () => {
        cancelled = true;
        sendRef.current = null;
        readyRef.current = false;
      };
    }, []);

    // Cão de guarda: se o motor não responder, mostra o erro em vez de ficar carregando para sempre
    useEffect(() => {
      if (Platform.OS === 'web' || webViewKey === 0) return;
      uciOkRef.current = false;
      const timer = setTimeout(() => {
        if (!uciOkRef.current) {
          handleLine('__sferror O motor não respondeu em 40 s. Feche e abra o app de novo.');
        }
      }, 40000);
      return () => clearTimeout(timer);
    }, [webViewKey]);

    /** Envia o motor para a página em pedaços (uma página de 2,5 MB trava alguns WebViews do Android). */
    const bootWebView = () => {
      const payload = payloadRef.current;
      const wv = webViewRef.current;
      if (!payload || !wv) return;

      const CHUNK = 200_000;
      for (let i = 0; i < payload.wasmBase64.length; i += CHUNK) {
        wv.injectJavaScript(`window.__sfAddWasm(${JSON.stringify(payload.wasmBase64.slice(i, i + CHUNK))});true;`);
      }
      wv.injectJavaScript(`window.__sfAddJs(${JSON.stringify(payload.jsCode)});true;`);
      wv.injectJavaScript('window.__sfBoot();true;');

      sendRef.current = (cmds) => {
        webViewRef.current?.injectJavaScript(`window.sfSend(${JSON.stringify(cmds)});true;`);
      };
    };

    const restartWebView = (reason: string) => {
      console.warn('[Stockfish] reiniciando o WebView:', reason);
      sendRef.current = null;
      readyRef.current = false;
      outstandingRef.current = 0;
      activeRef.current?.onAbort?.();
      activeRef.current = null;
      setStatus('loading');
      setWebViewKey((k) => k + 1);
    };

    // Nova análise ao vivo sempre que a posição ou a profundidade mudam
    useEffect(() => {
      startLive(fen);
    }, [fen, depth]);

    // Desligar a análise ao vivo interrompe a busca atual (se não for da revisão)
    useEffect(() => {
      if (liveEnabled) {
        startLive(currentFenRef.current);
      } else if (!reviewingRef.current && outstandingRef.current > 0 && sendRef.current) {
        activeRef.current = null;
        sendRef.current(['stop']);
      }
    }, [liveEnabled]);

    if (Platform.OS === 'web' || webViewKey === 0) return null;

    const { WebView } = require('react-native-webview');

    return (
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          key={webViewKey}
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: ENGINE_PAGE_HTML, baseUrl: 'https://localhost/' }}
          javaScriptEnabled
          webviewDebuggingEnabled={__DEV__}
          onLoadEnd={bootWebView}
          onMessage={(event: any) => handleLine(String(event.nativeEvent.data))}
          onError={(event: any) => handleLine(`__sferror WebView: ${event?.nativeEvent?.description ?? 'erro'}`)}
          onRenderProcessGone={() => restartWebView('processo do WebView encerrado (Android)')}
          onContentProcessDidTerminate={() => restartWebView('processo do WebView encerrado (iOS)')}
        />
      </View>
    );
  }
);

StockfishBridge.displayName = 'StockfishBridge';

/** Lê um asset empacotado; se o caminho local não puder ser lido, copia para o cache antes. */
async function readAsset(moduleId: number, encoding: 'utf8' | 'base64'): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const options = encoding === 'base64' ? { encoding: FileSystem.EncodingType.Base64 } : undefined;
  const uri = asset.localUri ?? asset.uri;
  try {
    return await FileSystem.readAsStringAsync(uri, options);
  } catch (first) {
    const target = `${FileSystem.cacheDirectory}sf-${asset.hash ?? asset.name}.${asset.type}`;
    try {
      await FileSystem.downloadAsync(asset.uri, target);
      return await FileSystem.readAsStringAsync(target, options);
    } catch {
      throw first;
    }
  }
}

/**
 * Página do WebView (pequena). O motor chega depois, em pedaços, via injectJavaScript.
 *  - Modo Worker (preferido): um Worker em Blob com os bytes do .wasm embutidos e `fetch` substituído.
 *  - Modo direto (plano B): se o Worker falhar ou não responder em 10 s, o Stockfish roda
 *    na própria página usando `wasmBinary`, sem Worker.
 * Só as linhas UCI úteis voltam para o app (evita inundar a ponte com mensagens).
 */
const ENGINE_PAGE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head><body>
<script>
(function () {
  var RN = window.ReactNativeWebView;
  function post(m) { if (RN) RN.postMessage(String(m)); }
  function out(m) {
    m = String(m);
    if (/^(id |uciok|readyok|bestmove)/.test(m) ||
        (m.indexOf('info ') === 0 && m.indexOf(' pv ') > 0 && m.indexOf(' score ') > 0)) post(m);
  }
  var wasmParts = [], jsParts = [], pending = [], send = null, gotUciOk = false, booted = false;

  window.__sfAddWasm = function (p) { wasmParts.push(p); };
  window.__sfAddJs = function (p) { jsParts.push(p); };
  window.sfSend = function (cmds) {
    for (var i = 0; i < cmds.length; i++) { if (send) send(cmds[i]); else pending.push(cmds[i]); }
  };
  function setSender(fn) {
    send = fn;
    var q = pending; pending = [];
    for (var i = 0; i < q.length; i++) fn(q[i]);
  }
  function decode(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  var WORKER_BOOT =
    '(function(){var bin=atob(__SF_WASM_B64);__SF_WASM_B64=null;var bytes=new Uint8Array(bin.length);' +
    'for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);' +
    'self.fetch=function(){return Promise.resolve(new Response(bytes,{status:200,headers:{"Content-Type":"application/wasm"}}));};' +
    'WebAssembly.instantiateStreaming=function(s,imp){return Promise.resolve(s).then(function(r){return r.arrayBuffer();}).then(function(b){return WebAssembly.instantiate(b,imp);});};' +
    '})();';

  function bootWorker(b64, js, fallback) {
    var worker, failed = false;
    function fail(why) {
      if (failed || gotUciOk) return;
      failed = true;
      try { worker && worker.terminate(); } catch (e) {}
      send = null;
      post('__sfinfo Worker indisponível (' + why + '), usando modo direto');
      fallback();
    }
    try {
      var code = 'var __SF_WASM_B64="' + b64 + '";' + WORKER_BOOT + js;
      worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })));
    } catch (e) { fail(String(e)); return; }
    worker.onmessage = function (e) {
      if (typeof e.data !== 'string') return;
      if (e.data === 'uciok') gotUciOk = true;
      out(e.data);
    };
    worker.onerror = function (e) {
      var msg = (e && e.message) || 'erro no worker';
      if (!gotUciOk) fail(msg); else post('__sferror ' + msg);
    };
    setSender(function (c) { worker.postMessage(c); });
    worker.postMessage('uci');
    setTimeout(function () { fail('sem resposta em 10 s'); }, 10000);
  }

  function bootMain(b64, js) {
    try {
      var s = document.createElement('script');
      s.text = js;
      document.body.appendChild(s);
      var factory = s._exports;
      if (typeof factory !== 'function') { post('__sferror motor não pôde ser iniciado (fábrica ausente)'); return; }
      factory({ wasmBinary: decode(b64), locateFile: function (p) { return p; }, listener: out })
        .then(function (sf) {
          var queue = [];
          function run(c) { sf.ccall('command', null, ['string'], [c], { async: /^go\\b/.test(c) }); }
          function flush() { while (queue.length && (!sf._isSearching || !sf._isSearching())) run(queue.shift()); }
          function cmd(c) {
            c = String(c).trim();
            if (c.indexOf('go') === 0 || c.indexOf('setoption') === 0) queue.push(c); else run(c);
            flush();
          }
          sf.onDoneSearching = function () { setTimeout(flush, 1); };
          (function waitReady() {
            if (sf._isReady && !sf._isReady()) return setTimeout(waitReady, 10);
            setSender(cmd);
            cmd('uci');
          })();
        }, function (err) { post('__sferror ' + err); });
    } catch (e) { post('__sferror ' + e); }
  }

  window.__sfBoot = function (forceMain) {
    if (booted) return;
    booted = true;
    var b64 = wasmParts.join(''), js = jsParts.join('');
    wasmParts = jsParts = null;
    if (forceMain || typeof Worker === 'undefined') bootMain(b64, js);
    else bootWorker(b64, js, function () { bootMain(b64, js); });
  };
})();
</script>
</body></html>`;

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});
