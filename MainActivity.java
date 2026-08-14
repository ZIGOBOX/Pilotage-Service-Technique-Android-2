package fr.zigobox.pilotagetechnique;

import android.Manifest;
import android.app.Activity;
import android.app.PrintManager;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Instances;
import android.print.PrintDocumentAdapter;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

public class MainActivity extends Activity {
    private static final String START_URL = "https://zigobox.github.io/service-Technique-2/";
    private static final String WORK_DOMAIN = "auvergnerhonealpes.fr";
    private static final int REQ_CALENDAR = 2001;
    private static final int REQ_FILE = 2002;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageLoaded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " PilotageServiceTechniqueAndroid/1.0");

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() == null ? "" : uri.getHost();
                if (host.endsWith("zigobox.github.io") || host.endsWith("supabase.co")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageLoaded = true;
                installPageHooks();
                ensureCalendarPermissionAndSync();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        webView.loadUrl(START_URL);
    }

    private void installPageHooks() {
        String js = "(function(){" +
                "if(window.__pstAndroidHooks)return;window.__pstAndroidHooks=true;" +
                "window.addEventListener('pst:data-loaded',function(){setTimeout(function(){try{AndroidBridge.syncCalendar();}catch(e){}},700);});" +
                "try{window.print=function(){AndroidBridge.printPage();};}catch(e){}" +
                "})();";
        webView.evaluateJavascript(js, null);
    }

    private void ensureCalendarPermissionAndSync() {
        if (checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED) {
            syncCalendarToWeb();
        } else {
            requestPermissions(new String[]{Manifest.permission.READ_CALENDAR}, REQ_CALENDAR);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CALENDAR) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                syncCalendarToWeb();
            } else {
                Toast.makeText(this, "Autorisation Calendrier nécessaire pour récupérer Outlook.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void syncCalendarToWeb() {
        if (!pageLoaded || checkSelfPermission(Manifest.permission.READ_CALENDAR) != PackageManager.PERMISSION_GRANTED) return;
        new Thread(() -> {
            try {
                CalendarResult result = readWorkCalendar();
                runOnUiThread(() -> injectEvents(result));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Synchronisation calendrier impossible : " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }).start();
    }

    private CalendarResult readWorkCalendar() throws Exception {
        ContentResolver cr = getContentResolver();
        Set<Long> calendarIds = new HashSet<>();

        String[] calProjection = {Calendars._ID, Calendars.ACCOUNT_NAME, Calendars.CALENDAR_DISPLAY_NAME, Calendars.VISIBLE};
        try (Cursor c = cr.query(Calendars.CONTENT_URI, calProjection, Calendars.VISIBLE + "=1", null, null)) {
            if (c != null) {
                while (c.moveToNext()) {
                    long id = c.getLong(0);
                    String account = c.getString(1) == null ? "" : c.getString(1);
                    String display = c.getString(2) == null ? "" : c.getString(2);
                    if (account.toLowerCase(Locale.ROOT).contains(WORK_DOMAIN) || display.toLowerCase(Locale.ROOT).contains(WORK_DOMAIN)) {
                        calendarIds.add(id);
                    }
                }
            }
        }

        Calendar start = Calendar.getInstance();
        start.add(Calendar.DAY_OF_YEAR, -30);
        start.set(Calendar.HOUR_OF_DAY, 0); start.set(Calendar.MINUTE, 0); start.set(Calendar.SECOND, 0); start.set(Calendar.MILLISECOND, 0);
        Calendar end = Calendar.getInstance();
        end.add(Calendar.DAY_OF_YEAR, 400);
        end.set(Calendar.HOUR_OF_DAY, 23); end.set(Calendar.MINUTE, 59); end.set(Calendar.SECOND, 59);

        JSONArray events = new JSONArray();
        if (!calendarIds.isEmpty()) {
            Uri.Builder builder = Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(builder, start.getTimeInMillis());
            ContentUris.appendId(builder, end.getTimeInMillis());
            Uri uri = builder.build();

            String[] projection = {
                    Instances.EVENT_ID, Instances.CALENDAR_ID, Instances.BEGIN, Instances.END,
                    Instances.TITLE, Instances.EVENT_LOCATION, Instances.DESCRIPTION, Instances.ALL_DAY
            };

            try (Cursor c = cr.query(uri, projection, null, null, Instances.BEGIN + " ASC")) {
                if (c != null) {
                    while (c.moveToNext()) {
                        long calendarId = c.getLong(1);
                        if (!calendarIds.contains(calendarId)) continue;
                        long eventId = c.getLong(0);
                        long begin = c.getLong(2);
                        long finish = c.getLong(3);
                        String title = c.getString(4);
                        String location = c.getString(5);
                        String description = c.getString(6);
                        boolean allDay = c.getInt(7) == 1;

                        JSONObject o = new JSONObject();
                        o.put("eventId", eventId);
                        o.put("begin", begin);
                        o.put("endMillis", finish);
                        o.put("date", formatDate(begin));
                        o.put("start", allDay ? "" : formatTime(begin));
                        o.put("end", allDay ? "" : formatTime(finish));
                        o.put("title", title == null || title.trim().isEmpty() ? "Rendez-vous Outlook" : title);
                        o.put("location", location == null ? "" : location);
                        o.put("notes", description == null ? "" : description);
                        o.put("allDay", allDay);
                        events.put(o);
                    }
                }
            }
        }
        return new CalendarResult(events, formatDate(start.getTimeInMillis()), formatDate(end.getTimeInMillis()), calendarIds.size());
    }

    private String formatDate(long millis) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.FRANCE);
        f.setTimeZone(TimeZone.getDefault());
        return f.format(new Date(millis));
    }

    private String formatTime(long millis) {
        SimpleDateFormat f = new SimpleDateFormat("HH:mm", Locale.FRANCE);
        f.setTimeZone(TimeZone.getDefault());
        return f.format(new Date(millis));
    }

    private void injectEvents(CalendarResult result) {
        String eventsJson = result.events.toString();
        String js = "(function(events,rangeStart,rangeEnd,calendarCount){" +
                "try{" +
                "if(typeof db==='undefined'||!db||!Array.isArray(db.personalEvents)||typeof save!=='function'||typeof currentUser==='undefined'||!currentUser){setTimeout(function(){try{AndroidBridge.syncCalendar();}catch(e){}},1800);return;}" +
                "var source='android-outlook';" +
                "db.personalEvents=db.personalEvents.filter(function(x){return !(x&&x.externalSource===source&&x.date>=rangeStart&&x.date<=rangeEnd);});" +
                "events.forEach(function(e){db.personalEvents.push({id:'outlook-'+e.eventId+'-'+e.begin,no:'OUT-'+e.eventId,date:e.date,start:e.start||'',end:e.end||'',type:'Rendez-vous Outlook',title:e.title||'Rendez-vous Outlook',location:e.location||'',priority:'Normale',status:'À faire',notes:e.notes||'',attachments:[],externalSource:source,externalEventId:String(e.eventId),externalBegin:e.begin,externalAllDay:!!e.allDay});});" +
                "save(false);" +
                "try{if(typeof renderPersonalCalendar==='function')renderPersonalCalendar();}catch(e){}" +
                "try{if(typeof renderDashboardTodayAgenda==='function')renderDashboardTodayAgenda();}catch(e){}" +
                "try{if(typeof renderPersonal==='function')renderPersonal();}catch(e){}" +
                "try{if(typeof toast==='function')toast(events.length+' rendez-vous Outlook synchronisés');}catch(e){}" +
                "}catch(err){console.error('Android Outlook sync',err);}" +
                "})(" + eventsJson + ",'" + result.rangeStart + "','" + result.rangeEnd + "'," + result.calendarCount + ");";
        webView.evaluateJavascript(js, null);
        if (result.calendarCount == 0) {
            Toast.makeText(this, "Calendrier professionnel @" + WORK_DOMAIN + " introuvable. Vérifiez la synchronisation Outlook.", Toast.LENGTH_LONG).show();
        }
    }

    private void printCurrentPage() {
        PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("Pilotage Service Technique");
        printManager.print("Pilotage Service Technique", adapter, null);
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void syncCalendar() {
            runOnUiThread(() -> ensureCalendarPermissionAndSync());
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> printCurrentPage());
        }
    }

    private static class CalendarResult {
        final JSONArray events;
        final String rangeStart;
        final String rangeEnd;
        final int calendarCount;
        CalendarResult(JSONArray events, String rangeStart, String rangeEnd, int calendarCount) {
            this.events = events;
            this.rangeStart = rangeStart;
            this.rangeEnd = rangeEnd;
            this.calendarCount = calendarCount;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }
}
