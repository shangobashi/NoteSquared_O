import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Image } from "react-native";
import { gsap } from "gsap";
import RecordScreen from "./screens/RecordScreen";
import ReviewScreen from "./screens/ReviewScreen";
import logo from "../assets/logo.png";

const steps = [
  {
    title: "Record or upload",
    body: "Capture lessons in one tap and keep the teacher present, not note-taking."
  },
  {
    title: "Extract lesson facts",
    body: "Structured extraction with evidence snippets keeps outputs grounded."
  },
  {
    title: "Generate polished outputs",
    body: "Student recap, practice plan, and parent email ready to edit."
  }
];

const outputs = [
  {
    label: "Student recap",
    detail: "Highlights, wins, and the next focus area in 150-300 words."
  },
  {
    label: "Practice plan",
    detail: "Seven-day plan with measurable targets and specific assignments."
  },
  {
    label: "Parent email",
    detail: "Professional summary ready to paste or send."
  }
];

const stats = [
  { value: "< 60s", label: "Target turnaround" },
  { value: "3 outputs", label: "Generated per lesson" },
  { value: "Schema-first", label: "Guardrails for trust" }
];

export default function App() {
  const [screen, setScreen] = useState<"record" | "review">("record");
  const [lessonId, setLessonId] = useState<string | null>(null);

  const rootRef = useRef<View | null>(null);
  const navRef = useRef<View | null>(null);
  const navCtaRef = useRef<View | null>(null);
  const heroRef = useRef<View | null>(null);
  const heroPanelRef = useRef<View | null>(null);
  const primaryCtaRef = useRef<View | null>(null);
  const glowTopRef = useRef<View | null>(null);
  const glowBottomRef = useRef<View | null>(null);
  const statRefs = useRef<Array<View | null>>([]);
  const stepRefs = useRef<Array<View | null>>([]);
  const outputRefs = useRef<Array<View | null>>([]);
  const footerRef = useRef<View | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      const style = document.createElement("style");
      style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        body { background: #0b0d11; }
      `;
      document.head.appendChild(style);
      return () => style.remove();
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const ctx = gsap.context(() => {
      const stepTargets = stepRefs.current.filter(Boolean);
      const outputTargets = outputRefs.current.filter(Boolean);

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(navRef.current, {
        opacity: 0,
        y: -18,
        duration: 0.6
      })
        .from(
          navCtaRef.current,
          {
            opacity: 0,
            scale: 0.92,
            duration: 0.4
          },
          "-=0.35"
        )
        .from(
          heroRef.current,
          {
            opacity: 0,
            y: 26,
            duration: 0.7
          },
          "-=0.2"
        )
        .from(
          heroPanelRef.current,
          {
            opacity: 0,
            x: 30,
            duration: 0.7
          },
          "-=0.45"
        )
        .from(
          statRefs.current.filter(Boolean),
          {
            opacity: 0,
            y: 12,
            scale: 0.96,
            stagger: 0.08,
            duration: 0.45
          },
          "-=0.25"
        );

      gsap.from(stepTargets, {
        opacity: 0,
        y: 20,
        rotateZ: -1.5,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.12,
        delay: 0.15
      });

      gsap.from(outputTargets, {
        opacity: 0,
        y: 18,
        scale: 0.97,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.14,
        delay: 0.3
      });

      gsap.from(footerRef.current, {
        opacity: 0,
        y: 18,
        duration: 0.6,
        ease: "power2.out",
        delay: 0.4
      });

      if (primaryCtaRef.current) {
        gsap.to(primaryCtaRef.current, {
          scale: 1.03,
          duration: 2.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 1.2
        });
      }

      if (heroPanelRef.current) {
        gsap.to(heroPanelRef.current, {
          y: -12,
          duration: 5.4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 0.6
        });
      }

      if (glowTopRef.current) {
        gsap.to(glowTopRef.current, {
          opacity: 0.75,
          scale: 1.12,
          x: -24,
          y: 18,
          duration: 8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1
        });
      }

      if (glowBottomRef.current) {
        gsap.to(glowBottomRef.current, {
          opacity: 0.6,
          scale: 1.1,
          x: 20,
          y: -16,
          duration: 9,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 0.8
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <SafeAreaView ref={rootRef} style={styles.page}>
      <View style={styles.backgroundGradient} />
      <View ref={glowTopRef} style={styles.backgroundGlowTop} />
      <View ref={glowBottomRef} style={styles.backgroundGlowBottom} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View ref={navRef} style={styles.nav}>
          <View style={styles.brandGroup}>
            <Image source={logo} style={styles.logoMark} />
            <Text style={styles.brand}>
              Note
              <Text style={styles.superscriptLarge}>2</Text>
            </Text>
          </View>
          <View style={styles.navActions}>
            <Pressable style={styles.navLink}>
              <Text style={styles.navLinkText}>How it works</Text>
            </Pressable>
            <Pressable ref={navCtaRef} style={styles.navCta}>
              <Text style={styles.navCtaText}>Request beta</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View ref={heroRef} style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>AI lesson notes, squared</Text>
            <Text style={styles.heroTitle}>Lesson notes without the homework.</Text>
            <Text style={styles.heroSubtitle}>
              <Text style={styles.inlineBrand}>
                Note
                <Text style={styles.superscript}>2</Text>
              </Text>{" "}
              turns recordings into grounded, editable outputs: student recap,
              practice plan, and parent email. Teach now, document later.
            </Text>
            <View style={styles.heroButtons}>
              <Pressable ref={primaryCtaRef} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Start a demo</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>View workflow</Text>
              </Pressable>
            </View>
            <View style={styles.heroStats}>
              {stats.map((item, index) => (
                <View
                  key={item.label}
                  ref={(node) => {
                    statRefs.current[index] = node;
                  }}
                  style={styles.statCard}
                >
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View ref={heroPanelRef} style={styles.heroPanel}>
            <Text style={styles.panelTitle}>Live workflow</Text>
            <Text style={styles.panelSubtitle}>
              This is the same flow as mobile, styled for web.
            </Text>
            <View style={styles.panelLogoRow}>
              <Image source={logo} style={styles.panelLogo} />
              <Text style={styles.panelLogoText}>Session preview</Text>
            </View>
            <View style={styles.panelDivider} />
            {screen === "record" && (
              <RecordScreen
                onCreated={(id) => {
                  setLessonId(id);
                  setScreen("review");
                }}
              />
            )}
            {screen === "review" && lessonId && (
              <ReviewScreen
                lessonId={lessonId}
                onBack={() => setScreen("record")}
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Text style={styles.sectionSubtitle}>
            A tight pipeline designed for trust, speed, and clarity.
          </Text>
          <View style={styles.grid}>
            {steps.map((step, index) => {
              return (
                <View
                  key={step.title}
                  ref={(node) => {
                    stepRefs.current[index] = node;
                  }}
                  style={styles.card}
                >
                  <Text style={styles.cardIndex}>0{index + 1}</Text>
                  <Text style={styles.cardTitle}>{step.title}</Text>
                  <Text style={styles.cardBody}>{step.body}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionAlt}>
          <Text style={styles.sectionTitle}>Outputs your studio can trust</Text>
          <Text style={styles.sectionSubtitle}>
            Built from structured extraction with evidence quotes to reduce hallucination.
          </Text>
          <View style={styles.grid}>
            {outputs.map((item, index) => {
              return (
                <View
                  key={item.label}
                  ref={(node) => {
                    outputRefs.current[index] = node;
                  }}
                  style={styles.cardAlt}
                >
                  <Text style={styles.outputLabel}>{item.label}</Text>
                  <Text style={styles.outputBody}>{item.detail}</Text>
                  <View style={styles.outputChip}>
                    <Text style={styles.outputChipText}>Editable in-app</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View ref={footerRef} style={styles.footer}>
          <View>
            <View style={styles.footerBrandRow}>
              <Image source={logo} style={styles.footerLogo} />
              <Text style={styles.footerBrand}>
                Note
                <Text style={styles.superscriptLarge}>2</Text>
              </Text>
            </View>
            <Text style={styles.footerText}>
              Built for independent teachers and studio owners who need time back.
            </Text>
          </View>
          <Pressable style={[styles.primaryButton, styles.footerCta]}>
            <Text style={styles.primaryButtonText}>Join the Pilot</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0a0e1a"
  },
  scroll: {
    paddingBottom: 120
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "linear-gradient(180deg, rgba(12,16,32,0.98) 0%, rgba(12,26,46,0.95) 45%, rgba(10,16,32,0.98) 100%)"
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: 999,
    backgroundImage:
      "radial-gradient(circle at center, rgba(88,112,255,0.4), rgba(88,112,255,0) 70%)"
  },
  backgroundGlowBottom: {
    position: "absolute",
    bottom: -200,
    left: -160,
    width: 460,
    height: 460,
    borderRadius: 999,
    backgroundImage:
      "radial-gradient(circle at center, rgba(255,179,71,0.3), rgba(255,179,71,0) 70%)"
  },
  nav: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 12
  },
  brand: {
    color: "#fdfcf7",
    fontSize: 26,
    fontFamily: "Plus Jakarta Sans",
    letterSpacing: 0.5
  },
  superscriptLarge: {
    fontSize: 14,
    lineHeight: 14,
    position: "relative",
    top: -8,
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  superscript: {
    fontSize: 12,
    lineHeight: 12,
    position: "relative",
    top: -6,
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  inlineBrand: {
    color: "#f7f9ff",
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  navLink: {
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  navLinkText: {
    color: "#d6d9db",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14
  },
  navCta: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#5870ff"
  },
  navCtaText: {
    color: "#f7f9ff",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    fontWeight: "600"
  },
  hero: {
    paddingHorizontal: 40,
    paddingTop: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 32
  },
  heroCopy: {
    flexBasis: 480,
    flexGrow: 1,
    gap: 16
  },
  heroEyebrow: {
    color: "#ffb347",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: "#fefdf8",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 46,
    lineHeight: 54
  },
  heroSubtitle: {
    color: "#c1cbe0",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 520
  },
  heroButtons: {
    flexDirection: "row",
    gap: 12
  },
  primaryButton: {
    backgroundColor: "#5870ff",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12
  },
  footerCta: {
    shadowColor: "#1a2a6b",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    boxShadow: "0 12px 24px rgba(26,42,107,0.35)"
  },
  primaryButtonText: {
    color: "#f7f9ff",
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(160,178,255,0.35)",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12
  },
  secondaryButtonText: {
    color: "#e7edff",
    fontFamily: "Plus Jakarta Sans",
    fontWeight: "600"
  },
  heroStats: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap"
  },
  statCard: {
    backgroundColor: "rgba(88,112,255,0.16)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 140
  },
  statValue: {
    color: "#f7f9ff",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 18
  },
  statLabel: {
    color: "#a7b4d6",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    marginTop: 6
  },
  heroPanel: {
    flexBasis: 380,
    flexGrow: 1,
    backgroundColor: "rgba(16,24,44,0.88)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(128,148,230,0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20
  },
  panelLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12
  },
  panelLogo: {
    width: 28,
    height: 28,
    borderRadius: 10
  },
  panelLogoText: {
    color: "#a7b4d6",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12
  },
  panelTitle: {
    color: "#fefdf8",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 18,
    fontWeight: "600"
  },
  panelSubtitle: {
    color: "#97a6c7",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 13,
    marginTop: 6
  },
  panelDivider: {
    height: 1,
    backgroundColor: "rgba(128,148,230,0.28)",
    marginVertical: 16
  },
  section: {
    paddingHorizontal: 40,
    paddingTop: 80
  },
  sectionAlt: {
    paddingHorizontal: 40,
    paddingTop: 80
  },
  sectionTitle: {
    color: "#fefdf8",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 32,
    marginBottom: 10
  },
  sectionSubtitle: {
    color: "#b3bfd8",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 16,
    marginBottom: 28,
    maxWidth: 640
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18
  },
  card: {
    flexBasis: 260,
    flexGrow: 1,
    backgroundColor: "rgba(88,112,255,0.1)",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(128,148,230,0.3)"
  },
  cardAlt: {
    flexBasis: 260,
    flexGrow: 1,
    backgroundColor: "rgba(255,179,71,0.1)",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,179,71,0.28)"
  },
  cardIndex: {
    color: "#ffb347",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    letterSpacing: 2
  },
  cardTitle: {
    color: "#fefdf8",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10
  },
  cardBody: {
    color: "#b4bfd6",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20
  },
  outputLabel: {
    color: "#f7f9ff",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 16,
    fontWeight: "600"
  },
  outputBody: {
    color: "#cbd6ef",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20
  },
  outputChip: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: "rgba(24,36,62,0.85)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999
  },
  outputChipText: {
    color: "#e7edff",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12
  },
  footer: {
    marginTop: 90,
    paddingHorizontal: 40,
    paddingVertical: 40,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,148,230,0.3)",
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16
  },
  footerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  footerLogo: {
    width: 30,
    height: 30,
    borderRadius: 10
  },
  footerBrand: {
    color: "#fefdf8",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 24
  },
  footerText: {
    color: "#a7b4d6",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    marginTop: 6,
    maxWidth: 320
  }
});






