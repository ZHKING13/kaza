import type { LucideIcon } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "./Button";
import { FormError } from "./FormError";
import { Text } from "./Text";
import { errorMessage } from "@/lib/api";
import { radius, space, useTheme } from "@/theme";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  /** Contenu entre le message et les boutons (motif à choisir, champ…) */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` pour une action qui retire ou annule quelque chose */
  tone?: "danger" | "primary";
  icon?: LucideIcon;
  /** Une erreur levée reste affichée dans la fenêtre ; la fenêtre se ferme si l'action réussit */
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
};

/**
 * Confirmation d'une action qui ne se rattrape pas facilement : fenêtre en bas de l'écran, au-dessus de tout,
 * avec le titre, l'explication et deux boutons (le bouton d'action en dernier, sous le pouce).
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  children,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "danger",
  icon,
  onConfirm,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const close = () => {
    if (busy) return;
    setError(undefined);
    onClose();
  };
  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm();
      setBusy(false);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      {/* Un champ dans la fenêtre (motif) reste au-dessus du clavier */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityLabel="Fermer"
          onPress={close}
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={() => {}}
            style={{
              backgroundColor: c.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: space.lg,
              paddingBottom: insets.bottom + space.lg,
              gap: space.md,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: c.border,
                marginTop: -space.xs,
              }}
            />
            <Text variant="h3" accessibilityRole="header">
              {title}
            </Text>
            {message ? <Text tone="muted">{message}</Text> : null}
            {children}
            <FormError message={error} />
            <View style={{ gap: space.xs }}>
              <Button
                label={busy ? "Un instant…" : confirmLabel}
                icon={icon}
                variant={tone === "danger" ? "danger" : "primary"}
                disabled={busy}
                onPress={confirm}
              />
              <Button
                label={cancelLabel}
                variant="ghost"
                disabled={busy}
                onPress={close}
              />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
