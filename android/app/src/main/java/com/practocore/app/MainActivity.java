package com.practocore.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Registered before super so the bridge picks the plugin up during its
        // own initialisation; a later registration is not seen by the WebView.
        registerPlugin(UpdateNotifications.class);
        super.onCreate(savedInstanceState);
    }
}
