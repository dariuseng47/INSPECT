package com.reactlibrary.seuic;

import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.seuic.scankey.IKeyEventCallback;
import com.seuic.scankey.ScanKeyService;
import com.seuic.uhf.EPC;
import com.seuic.uhf.IReadTagsListener;
import com.seuic.uhf.UHFService;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bridge ไป UHF module + ปุ่มไกในตัวเครื่อง SEUIC AUTOID UTouch 2 ผ่าน system SDK
 * (com.seuic.uhf.UHFService + com.seuic.scankey.ScanKeyService)
 *
 * ต่างจาก RNRfidOrca50Module:
 *  - ไม่มี serial-port thread / ไม่มี .so — คุยกับ system server com.seuic.uhfserver โดยตรง
 *  - รับแท็กแบบ push ผ่าน registerReadTags() → ยิงเป็น TagEvent ทีละ EPC (มี dedup ด้วย Set)
 *  - ScanKeyService.registerCallback(cb, "250") ให้ event ปุ่มไกด้ามปืนจริง (scancode 250 =
 *    0x00fa ยืนยันด้วย getevent บนเครื่อง) → ยิงเป็น TriggerDown / TriggerUp
 *  - ฝั่ง JS (useTriggerScan) เป็นตัวสั่ง startRead()/stopRead() รอบ ๆ TriggerDown/Up เอง
 *
 * ทุกจุดที่แตะคลาส com.seuic.* จับ Throwable — บนมือถือรุ่นอื่นที่ไม่มี SDK นี้ การอ้างคลาสจะ
 * โยน NoClassDefFoundError (เป็น Error ไม่ใช่ Exception) ต้องไม่ให้หลุดไปทำแอปทั้งตัว crash
 * ด้วยเหตุนี้ readListener / keyCallback / uhf / scanKey จึงสร้างแบบ lazy ใน connect() เท่านั้น
 */
public class RNRfidSeuicModule extends ReactContextBaseJavaModule implements LifecycleEventListener {

    private static final String NAME = "RNRfidSeuic";

    // ค่าเริ่มต้นที่ยืนยันหน้างานแล้วว่าอ่านกองผ้าครบ (แอป UHF ในตัวเครื่อง: Power 30 / S2 / P1 /
    // Target A / China1) — ปรับที่นี่ได้ถ้าจูนใหม่ ส่วน power ตัวจริง JS จะ setAntennaPower ทับ
    // ตามค่าที่ผู้ใช้ตั้งในหน้า "ตั้งค่าเครื่อง" ทันทีหลัง connect
    private static final String REGION_THAILAND = "China1"; // 920–925 MHz = ย่าน กสทช.
    private static final int DEFAULT_POWER_DBM = 30;        // ช่วง 1–33
    private static final int SESSION_S2 = 2;                // UHFService.Session S0..S3 = 0..3
    private static final int PROFILE_P1 = 1;                // UHFService.Profile P0..P3 = 0..3
    private static final int TARGET_A = 0;                  // UHFService.Target A,B = 0,1
    private static final String TRIGGER_SCANCODE = "250";   // ปุ่มไกด้ามปืน UTouch 2

    private final ReactApplicationContext reactContext;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private UHFService uhf = null;
    private ScanKeyService scanKey = null;
    private IReadTagsListener readListener = null;
    private IKeyEventCallback keyCallback = null;

    private volatile boolean connected = false;
    private final Set<String> seen = new HashSet<>();

    public RNRfidSeuicModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
        context.addLifecycleEventListener(this);
    }

    @Override
    public String getName() {
        return NAME;
    }

    // ---- events -------------------------------------------------------------

    private void emit(String name, Object data) {
        try {
            if (reactContext.hasActiveReactInstance()) {
                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit(name, data);
            }
        } catch (Throwable ignored) {
        }
    }

    private void emitError(Throwable t) {
        emit("HandleError", t == null ? "unknown error" : String.valueOf(t.getMessage()));
    }

    // ---- lifecycle -------------------------------------------------------------

    @Override
    public void onHostResume() {
        // แย่งปุ่มไกกลับมาเมื่อแอปกลับมา foreground (ScanKeyService: callback ที่ register ทีหลัง
        // สุดเป็นผู้ได้รับ — ปล่อยให้แอป UHF ในตัวเครื่องได้คืนตอนเราพักหน้าจอ)
        if (connected && scanKey != null && keyCallback != null) {
            try {
                scanKey.registerCallback(keyCallback, TRIGGER_SCANCODE);
            } catch (Throwable t) {
                emitError(t);
            }
        }
    }

    @Override
    public void onHostPause() {
        if (connected) {
            executor.execute(() -> {
                try {
                    if (uhf != null) uhf.inventoryStop();
                    if (scanKey != null && keyCallback != null) scanKey.unregisterCallback(keyCallback);
                } catch (Throwable t) {
                    emitError(t);
                }
            });
        }
    }

    @Override
    public void onHostDestroy() {
        disconnect();
    }

    // ---- API ที่ฝั่ง JS (SeuicScanner) เรียก --------------------------------

    @ReactMethod
    public void connect(final Callback callback) {
        executor.execute(() -> {
            boolean ok = false;
            try {
                uhf = UHFService.getInstance();
                ok = uhf.open();
                if (ok) {
                    try {
                        uhf.setRegion(REGION_THAILAND);
                        uhf.setPower(DEFAULT_POWER_DBM);
                        uhf.setParameters(UHFService.PARAMETER_INVENTORY_SESSION, SESSION_S2);
                        uhf.setParameters(UHFService.PARAMETER_LINK_PROFILE, PROFILE_P1);
                        uhf.setParameters(UHFService.PARAMETER_INVENTORY_SESSION_TARGET, TARGET_A);
                        uhf.setParameters(UHFService.PARAMETER_CLEAR_EPCLIST_WHEN_START_INVENTORY, 1);
                        uhf.setParameters(UHFService.PARAMETER_HIDE_PC, 1);
                    } catch (Throwable t) {
                        // ตั้งพารามิเตอร์ไม่ผ่านไม่ถือว่า connect ล้ม — โมดูลเปิดได้แล้ว
                        emitError(t);
                    }

                    if (readListener == null) {
                        readListener = new IReadTagsListener() {
                            @Override
                            public void tagsRead(List<EPC> tags) {
                                if (tags == null) return;
                                for (EPC tag : tags) {
                                    if (tag == null) continue;
                                    String epc = tag.getId();
                                    if (epc == null) continue;
                                    epc = epc.replaceAll("\\s", "");
                                    if (epc.isEmpty()) continue;
                                    synchronized (seen) {
                                        if (!seen.add(epc)) continue;
                                    }
                                    emit("TagEvent", epc);
                                }
                            }
                        };
                    }
                    uhf.registerReadTags(readListener);

                    scanKey = ScanKeyService.getInstance();
                    if (keyCallback == null) {
                        keyCallback = new IKeyEventCallback.Stub() {
                            @Override
                            public void onKeyDown(int keyCode) {
                                emit("TriggerDown", keyCode);
                            }

                            @Override
                            public void onKeyUp(int keyCode) {
                                emit("TriggerUp", keyCode);
                            }
                        };
                    }
                    scanKey.registerCallback(keyCallback, TRIGGER_SCANCODE);

                    connected = true;
                }
            } catch (Throwable t) {
                emitError(t);
                ok = false;
            }
            callback.invoke(ok);
        });
    }

    @ReactMethod
    public void disconnect() {
        connected = false;
        executor.execute(() -> {
            try {
                if (scanKey != null && keyCallback != null) scanKey.unregisterCallback(keyCallback);
            } catch (Throwable t) {
                emitError(t);
            }
            try {
                if (uhf != null) {
                    uhf.inventoryStop();
                    uhf.unregisterReadTags(readListener);
                    uhf.close();
                }
            } catch (Throwable t) {
                emitError(t);
            }
            synchronized (seen) {
                seen.clear();
            }
        });
    }

    @ReactMethod
    public void isConnected(final Callback callback) {
        callback.invoke(connected);
    }

    @ReactMethod
    public void startRead() {
        executor.execute(() -> {
            try {
                synchronized (seen) {
                    seen.clear();
                }
                if (uhf != null) uhf.inventoryStart();
            } catch (Throwable t) {
                emitError(t);
            }
        });
    }

    @ReactMethod
    public void stopRead() {
        executor.execute(() -> {
            try {
                if (uhf != null) uhf.inventoryStop();
            } catch (Throwable t) {
                emitError(t);
            }
        });
    }

    @ReactMethod
    public void cleanTagBuffer() {
        executor.execute(() -> {
            try {
                synchronized (seen) {
                    seen.clear();
                }
                if (uhf != null) uhf.setParameters(UHFService.PARAMETER_CLEAR_EPCLIST, 1);
            } catch (Throwable t) {
                emitError(t);
            }
        });
    }

    @ReactMethod
    public void setAntennaPower(final String level) {
        executor.execute(() -> {
            try {
                if (uhf != null) uhf.setPower(Integer.parseInt(level));
            } catch (Throwable t) {
                emitError(t);
            }
        });
    }

    @ReactMethod
    public void getAntennaPower() {
        executor.execute(() -> {
            try {
                if (uhf != null) emit("getPowerLevel", String.valueOf(uhf.getPower()));
            } catch (Throwable t) {
                emitError(t);
            }
        });
    }

    // RN ต้องการ addListener/removeListeners เพื่อไม่ให้ warn เรื่อง NativeEventEmitter
    @ReactMethod
    public void addListener(String eventName) {
    }

    @ReactMethod
    public void removeListeners(Integer count) {
    }
}
