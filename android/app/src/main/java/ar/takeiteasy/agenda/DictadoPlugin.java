package ar.takeiteasy.agenda;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;

/**
 * Dictado por voz, y sólo el que hace el teléfono solo (regla 1.2).
 *
 * Este archivo existe porque los plugins de dictado que hay dan a elegir entre
 * dos cosas que el proyecto no puede aceptar. El de la comunidad usa el
 * reconocedor común de Android, que sube el audio al servidor. El de capgo sí
 * reconoce en el dispositivo, pero llama a `SpeechRecognizer` desde el hilo en
 * el que Capacitor corre los plugins, y Android sólo lo permite desde el hilo
 * principal: la excepción que eso tira cierra la app entera.
 *
 * Acá hay dos garantías, y las dos son la razón de ser del archivo:
 *
 * 1. **Sólo reconocimiento en el dispositivo.** Se usa
 *    `createOnDeviceSpeechRecognizer()` y nunca `createSpeechRecognizer()`, y
 *    la intención lleva siempre `EXTRA_PREFER_OFFLINE`. No hay una rama que
 *    caiga al reconocedor del servidor, ni siquiera cuando el otro falla.
 *
 * 2. **Todo lo que toca `SpeechRecognizer` corre en el hilo principal.** Es lo
 *    único que Android acepta, y no hacerlo no da un error: cierra la app.
 *
 * El audio no sale del teléfono. No hay red en este archivo.
 */
@CapacitorPlugin(
    name = "Dictado",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = DictadoPlugin.MICROFONO) }
)
public class DictadoPlugin extends Plugin {

    public static final String MICROFONO = "microfono";

    /** Sólo se toca desde el hilo principal. */
    private SpeechRecognizer reconocedor;
    private boolean escuchando = false;

    /**
     * Si este teléfono reconoce voz sin mandar el audio a ningún lado.
     *
     * Es estática y no necesita una instancia, así que se puede contestar desde
     * cualquier hilo. Hace falta Android 13, que es cuando aparece el
     * reconocimiento en el dispositivo.
     */
    @PluginMethod
    public void disponible(PluginCall call) {
        boolean hay = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hay = SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
        }
        JSObject respuesta = new JSObject();
        respuesta.put("disponible", hay);
        call.resolve(respuesta);
    }

    @PluginMethod
    public void empezar(final PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.reject("SIN_RECONOCIMIENTO_LOCAL");
            return;
        }
        if (getPermissionState(MICROFONO) != PermissionState.GRANTED) {
            call.reject("SIN_PERMISO");
            return;
        }

        final String idioma = call.getString("idioma", "es-AR");

        getActivity()
            .runOnUiThread(
                new Runnable() {
                    @Override
                    public void run() {
                        try {
                            soltarReconocedor();
                            reconocedor = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                            reconocedor.setRecognitionListener(new Escucha());
                            reconocedor.startListening(intencion(idioma));
                            escuchando = true;
                            call.resolve();
                        } catch (Exception e) {
                            // Sin respaldo por servidor: si el reconocimiento en
                            // el dispositivo no anda, se escribe a mano (1.2).
                            soltarReconocedor();
                            call.reject("NO_SE_PUDO_EMPEZAR");
                        }
                    }
                }
            );
    }

    @PluginMethod
    public void parar(final PluginCall call) {
        getActivity()
            .runOnUiThread(
                new Runnable() {
                    @Override
                    public void run() {
                        soltarReconocedor();
                        call.resolve();
                    }
                }
            );
    }

    @PluginMethod
    public void estaEscuchando(PluginCall call) {
        JSObject respuesta = new JSObject();
        respuesta.put("escuchando", escuchando);
        call.resolve(respuesta);
    }

    /**
     * `EXTRA_PREFER_OFFLINE` va siempre. Es la misma regla que
     * `createOnDeviceSpeechRecognizer`, dicha dos veces a propósito: son dos
     * puertas distintas y las dos tienen que estar cerradas.
     */
    private Intent intencion(String idioma) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        return intent;
    }

    /** Siempre en el hilo principal. */
    private void soltarReconocedor() {
        escuchando = false;
        if (reconocedor == null) return;
        try {
            reconocedor.cancel();
            reconocedor.destroy();
        } catch (Exception e) {
            // Soltar no puede fallar hacia afuera: lo que importa es que quede
            // apagado, y queda.
        }
        reconocedor = null;
    }

    @Override
    protected void handleOnDestroy() {
        // La pantalla se fue: el micrófono no se queda prendido atrás.
        soltarReconocedor();
        super.handleOnDestroy();
    }

    private void avisarFin(String motivo) {
        escuchando = false;
        JSObject datos = new JSObject();
        if (motivo != null) datos.put("motivo", motivo);
        notifyListeners("fin", datos);
    }

    private void avisarTexto(Bundle resultados) {
        if (resultados == null) return;
        ArrayList<String> dichos = resultados.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (dichos == null || dichos.isEmpty()) return;
        JSObject datos = new JSObject();
        datos.put("texto", dichos.get(0));
        notifyListeners("texto", datos);
    }

    private class Escucha implements RecognitionListener {

        @Override
        public void onPartialResults(Bundle resultados) {
            avisarTexto(resultados);
        }

        @Override
        public void onResults(Bundle resultados) {
            avisarTexto(resultados);
            avisarFin(null);
        }

        @Override
        public void onError(int error) {
            avisarFin(comoSeLlama(error));
        }

        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rms) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onEvent(int tipo, Bundle params) {}
    }

    /**
     * Los códigos de Android no se le muestran a nadie: se traducen a algo que
     * la app pueda contar en castellano.
     */
    private static String comoSeLlama(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "AUDIO";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "SIN_PERMISO";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "NO_SE_ENTENDIO";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "NO_SE_ENTENDIO";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "OCUPADO";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
                return "IDIOMA_NO_DISPONIBLE";
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                return "IDIOMA_NO_DISPONIBLE";
            default:
                return "SE_CORTO";
        }
    }
}
