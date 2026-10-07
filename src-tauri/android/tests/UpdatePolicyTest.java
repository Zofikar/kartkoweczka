import pl.chwalczyk.kartkoweczka.UpdatePolicy;
import java.net.URL;
import java.util.Set;

public final class UpdatePolicyTest {
    private static int checks;

    private static void rejects(Runnable action) {
        try { action.run(); }
        catch (IllegalArgumentException expected) { checks++; return; }
        throw new AssertionError("Expected rejection");
    }

    private static void candidate(String pkg, String version, long code, Set<String> signers) {
        UpdatePolicy.validateCandidate("app", pkg, "1.2.3", version, "1.2.4",
            10, code, Set.of("trusted"), signers);
    }

    public static void main(String[] args) throws Exception {
        if (UpdatePolicy.versionParts("2.0.0") <= UpdatePolicy.versionParts("1.99999.99999"))
            throw new AssertionError("Major ordering");
        if (UpdatePolicy.versionParts("1.10.0") <= UpdatePolicy.versionParts("1.9.99999"))
            throw new AssertionError("Minor ordering");
        checks += 2;
        for (String version : new String[] {"", "1.2", "v1.2.3", "1.2.3-beta", "-1.2.3", "100000.0.0", "1.2.3.4", "9999999999999999999999.0.0"})
            rejects(() -> UpdatePolicy.versionParts(version));
        for (String host : new String[] {"github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}) {
            UpdatePolicy.validateConnection(new URL("https://" + host + "/asset"));
            checks++;
        }
        for (String address : new String[] {"http://github.com/a", "https://evil.test/a", "https://github.com.evil.test/a", "https://user@github.com/a", "https://github.com:444/a"}) {
            URL url = new URL(address);
            rejects(() -> UpdatePolicy.validateConnection(url));
        }
        UpdatePolicy.validateRepository("https://github.com/Zofikar/kartkoweczka/releases/download/v1.2.4/app.apk");
        checks++;
        rejects(() -> UpdatePolicy.validateRepository("https://github.com/attacker/app/releases/download/a.apk"));
        candidate("app", "1.2.4", 11, Set.of("trusted"));
        checks++;
        rejects(() -> candidate("other", "1.2.4", 11, Set.of("trusted")));
        rejects(() -> candidate("app", "1.2.5", 11, Set.of("trusted")));
        rejects(() -> candidate("app", "1.2.4", 10, Set.of("trusted")));
        rejects(() -> candidate("app", "1.2.4", 9, Set.of("trusted")));
        rejects(() -> candidate("app", "1.2.4", 11, Set.of("attacker")));
        rejects(() -> candidate("app", "1.2.4", 11, Set.of()));
        rejects(() -> candidate("app", "1.2.4", 11, Set.of("trusted", "attacker")));
        rejects(() -> UpdatePolicy.validateCandidate("app", "app", "1.2.4", "1.2.3", "1.2.3", 10, 11, Set.of("trusted"), Set.of("trusted")));
        rejects(() -> UpdatePolicy.validateCandidate("app", "app", "1.2.3", "1.2.4", "1.2.4", 10, 11, Set.of(), Set.of()));
        System.out.println("Passed " + checks + " Android update policy checks");
    }
}