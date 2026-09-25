# MediTrack Android App

This is a native Android shell (WebView-based) that wraps the MediTrack web application.

## Prerequisites & Deployment
The MediTrack web application must be served over **HTTPS** for the Android WebView to successfully request camera permissions (a strict security requirement for `getUserMedia`). 

### Deploying the Web App (Vercel/Netlify)
If your `index.html` is not yet deployed:
1. **Netlify (Drag and Drop):**
   - Go to [netlify.com/drop](https://app.netlify.com/drop).
   - Drag the folder containing your `index.html` onto the page.
   - Netlify will instantly deploy it and provide a secure HTTPS URL.
2. **Vercel (CLI):**
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel` in the folder containing `index.html`.
   - Follow the prompts to deploy and get your HTTPS URL.

## How to Configure the App
Once you have your deployed HTTPS URL:
1. Open `android-app/app/src/main/java/com/example/meditrack/MainActivity.kt` in Android Studio or any text editor.
2. Locate the following line:
   ```kotlin
   private val webAppUrl = "https://meditrack-demo.vercel.app/"
   ```
3. Replace the placeholder URL with your actual deployed URL.

## How to Build & Sign the APK
1. **Open the project:** Open Android Studio and select **Open**. Navigate to the `android-app` folder inside your project directory.
2. **Sync Project:** Android Studio will automatically download Gradle and sync the project dependencies.
3. **Build Debug APK (for testing):**
   - Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - The APK will be generated in `android-app/app/build/outputs/apk/debug/`.
4. **Build Signed APK (for production):**
   - Go to **Build > Generate Signed Bundle / APK...**
   - Select **APK** and click Next.
   - Create a new Key Store or use an existing one. Fill in the required password and alias.
   - Select the **release** build variant and click **Finish**.
   - The signed APK will be generated and ready to be installed on any Android device.

## Known WebView + Camera Quirks
When working with HTML5 QR scanners inside an Android WebView, keep these Android-specific quirks in mind:
- **HTTPS is Mandatory:** As mentioned, `getUserMedia` will silently fail or throw a NotAllowedError if the URL does not start with `https://`.
- **Dual Permissions:** You must grant BOTH the Android runtime permission (the system dialog) AND the WebView's internal permission (`WebChromeClient.onPermissionRequest`). This app is pre-configured to handle both!
- **Hardware Acceleration:** Some QR scanning libraries (like `html5-qrcode`) might have performance issues on older devices if hardware acceleration is disabled. It is enabled by default in this app.
- **Backgrounding:** When the app is minimized (put in the background), the camera feed might freeze or fail to release the camera hardware on certain heavily customized Android skins (e.g., MIUI, ColorOS). The `SwipeRefreshLayout` (pull-to-refresh) added to the app helps quickly reset the state if this occurs.
- **Local Storage Persistence:** The web app has been updated to use `localStorage` instead of `sessionStorage`. `sessionStorage` gets wiped when the Android app is fully closed, whereas `localStorage` persists, ensuring the user stays logged in across app restarts.
