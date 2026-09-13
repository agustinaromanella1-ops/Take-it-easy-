package ar.takeiteasy.agenda;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // El dictado es un plugin de esta app y no una dependencia: la regla de
        // que el audio no sale del teléfono se cumple en código propio.
        registerPlugin(DictadoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
