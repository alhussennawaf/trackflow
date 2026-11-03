// Compile-time stub of the API 28 class. The device provides the real one;
// this file is never packaged into the APK.
package android.hardware.biometrics;

import android.content.Context;
import android.content.DialogInterface;
import android.os.CancellationSignal;
import java.util.concurrent.Executor;

public class BiometricPrompt {
  public static abstract class AuthenticationCallback {
    public void onAuthenticationError(int errorCode, CharSequence errString) {}
    public void onAuthenticationHelp(int helpCode, CharSequence helpString) {}
    public void onAuthenticationSucceeded(AuthenticationResult result) {}
    public void onAuthenticationFailed() {}
  }
  public static class AuthenticationResult {}
  public static class Builder {
    public Builder(Context c) { throw new RuntimeException("stub"); }
    public Builder setTitle(CharSequence t) { throw new RuntimeException("stub"); }
    public Builder setSubtitle(CharSequence t) { throw new RuntimeException("stub"); }
    public Builder setNegativeButton(CharSequence t, Executor e, DialogInterface.OnClickListener l) { throw new RuntimeException("stub"); }
    public BiometricPrompt build() { throw new RuntimeException("stub"); }
  }
  public void authenticate(CancellationSignal s, Executor e, AuthenticationCallback cb) { throw new RuntimeException("stub"); }
}
