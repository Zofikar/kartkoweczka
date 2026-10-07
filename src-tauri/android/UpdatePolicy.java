package pl.chwalczyk.kartkoweczka;

import java.net.URL;
import java.util.Set;

/** Platform-independent checks shared by the Android updater and JVM tests. */
public final class UpdatePolicy {
    private UpdatePolicy() {}

    public static long versionParts(String value) {
        require(value != null && value.matches("[0-9]+\\.[0-9]+\\.[0-9]+"), "Unsupported release version");
        String[] parts = value.split("\\.");
        long result = 0;
        for (String part : parts) {
            require(part.length() <= 5, "Release version is out of range");
            result = result * 100000 + Long.parseLong(part);
        }
        return result;
    }

    public static void validateConnection(URL url) {
        require(url.getProtocol().equals("https") && url.getUserInfo() == null
            && (url.getPort() == -1 || url.getPort() == 443), "Update requires HTTPS on the default port");
        String host = url.getHost();
        require(host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
            || host.equals("objects.githubusercontent.com"), "Unexpected update download host");
    }

    public static void validateRepository(String address) {
        require(address.startsWith("https://github.com/Zofikar/kartkoweczka/releases/download/"),
            "APK must come from this application's release repository");
    }

    public static void validateCandidate(String installedPackage, String candidatePackage,
        String installedVersion, String candidateVersion, String expectedVersion,
        long installedCode, long candidateCode, Set<String> installedSigners, Set<String> candidateSigners) {
        require(installedPackage.equals(candidatePackage), "APK package identity does not match");
        require(expectedVersion.equals(candidateVersion), "APK does not match release version");
        require(versionParts(candidateVersion) > versionParts(installedVersion), "APK would downgrade the installed app");
        require(candidateCode > installedCode, "APK version code must increase");
        require(!installedSigners.isEmpty() && installedSigners.equals(candidateSigners),
            "APK signing certificate does not match installed app");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
}