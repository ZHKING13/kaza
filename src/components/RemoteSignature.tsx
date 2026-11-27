import { router } from "expo-router";
import { Lock, PenLine, Send, X } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { usePlan, useStore } from "@/data/store";
import type { Tenant } from "@/data/types";
import { errorMessage } from "@/lib/api";
import { formatDateLong } from "@/lib/format";
import { openWhatsApp } from "@/lib/whatsapp";
import { radius, space, useTheme } from "@/theme";

import { Button } from "./Button";
import { Card } from "./Card";
import { ConfirmSheet } from "./ConfirmSheet";
import { FormError } from "./FormError";
import { PdfButton } from "./PdfButton";
import { SignaturePad } from "./SignaturePad";
import { Text } from "./Text";

const message = (tenant: Tenant, url: string) =>
  `Bonjour ${tenant.firstName}, voici votre contrat de bail à lire et à signer sur votre téléphone : ${url}\nPour signer, vous recevrez un code par WhatsApp.`;

/**
 * Signature électronique à distance (offres payantes, compte en ligne) : le bailleur signe ici, le contrat part au
 * locataire par WhatsApp avec son lien ; le locataire signe sur son téléphone avec un code reçu par WhatsApp. Le
 * contrat signé revient avec son certificat de signature.
 */
export function RemoteSignature({
  tenant,
  html,
  fileName,
  beforeSend,
}: {
  tenant: Tenant;
  html: (landlordSignature: string) => string;
  fileName: string;
  /** Enregistre d'abord ce qui est à l'écran (le contrat envoyé le reprend) */
  beforeSend?: () => Promise<void>;
}) {
  const { c } = useTheme();
  const { remote, requestSignature, cancelSignature, signatureDocument } =
    useStore();
  const { limits } = usePlan();
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [cancelling, setCancelling] = useState(false);
  const [again, setAgain] = useState(false);
  const request = tenant.signatureRequest;

  const share = (url: string | null) => {
    if (url)
      openWhatsApp(tenant.phone, message(tenant, url)).catch(() =>
        setError("WhatsApp n’a pas pu s’ouvrir."),
      );
  };

  const send = async () => {
    if (!signature) return;
    setBusy(true);
    setError(undefined);
    try {
      await beforeSend?.();
      const sent = await requestSignature(
        tenant.id,
        html(signature),
        signature,
      );
      setSignature(null);
      setAgain(false);
      share(sent.url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (!remote) {
    body = (
      <Text variant="small" tone="muted">
        Disponible avec un compte Kaza en ligne : le contrat part au locataire
        par WhatsApp, il le signe sur son téléphone.
      </Text>
    );
  } else if (!limits.eSignature) {
    body = (
      <View style={{ gap: space.sm }}>
        <View
          style={{ flexDirection: "row", gap: space.xs, alignItems: "center" }}
        >
          <Lock size={16} color={c.textMuted} />
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            Comprise dans les offres Famille et Agence. Sans elle, imprimez le
            contrat et photographiez-le une fois signé.
          </Text>
        </View>
        <Button
          label="Voir les offres"
          variant="secondary"
          onPress={() => router.push("/offre")}
        />
      </View>
    );
  } else if (request?.status === "pending" && !again) {
    body = (
      <View style={{ gap: space.sm }}>
        <View
          style={{
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.md,
            padding: space.sm,
            gap: 2,
          }}
        >
          <Text variant="bodyStrong">
            En attente de la signature de {tenant.firstName}
          </Text>
          <Text variant="small" tone="muted">
            Envoyé le {formatDateLong(request.createdAt)}
            {request.codeSentAt
              ? ` · code demandé le ${formatDateLong(request.codeSentAt)}`
              : " · pas encore ouvert"}
          </Text>
        </View>
        <Button
          label="Renvoyer le lien par WhatsApp"
          icon={Send}
          variant="secondary"
          disabled={!request.url}
          onPress={() => share(request.url)}
        />
        <Button
          label="Annuler la demande"
          icon={X}
          variant="ghost"
          onPress={() => setCancelling(true)}
        />
      </View>
    );
  } else if (request?.status === "signed" && !again) {
    body = (
      <View style={{ gap: space.sm }}>
        <View
          style={{
            backgroundColor: c.primarySoft,
            borderRadius: radius.md,
            padding: space.sm,
            gap: 2,
          }}
        >
          <Text variant="bodyStrong" tone="primary">
            Signé par {request.signerName}
          </Text>
          <Text variant="small" tone="muted">
            Le {request.signedAt ? formatDateLong(request.signedAt) : ""}, avec
            un code envoyé par WhatsApp. Le certificat de signature est joint au
            contrat.
          </Text>
        </View>
        <PdfButton
          label="Partager le contrat signé (PDF)"
          html={() => signatureDocument(tenant.id)}
          fileName={`${fileName}-signe`}
          variant="primary"
        />
        <Button
          label="Faire signer un nouveau contrat"
          variant="ghost"
          onPress={() => setAgain(true)}
        />
      </View>
    );
  } else {
    body = (
      <View style={{ gap: space.sm }}>
        <Text variant="small" tone="muted">
          Signez ci-dessous : le contrat (tel qu’à l’écran) part à{" "}
          {tenant.firstName} par WhatsApp. Il le lit et le signe sur son
          téléphone avec un code reçu par WhatsApp.
        </Text>
        <SignaturePad
          label="Votre signature"
          value={signature}
          onChange={setSignature}
        />
        <Button
          label={
            busy ? "Envoi…" : `Envoyer à ${tenant.firstName} pour signature`
          }
          icon={PenLine}
          disabled={busy || !signature}
          onPress={send}
        />
        {again ? (
          <Button
            label="Retour"
            variant="ghost"
            onPress={() => setAgain(false)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="h3" accessibilityRole="header">
        Signature à distance
      </Text>
      {body}
      <FormError message={error} />
      <ConfirmSheet
        visible={cancelling}
        title="Annuler la demande de signature ?"
        message={`Le lien envoyé à ${tenant.firstName} ne permettra plus de signer ce contrat.`}
        confirmLabel="Annuler la demande"
        onClose={() => setCancelling(false)}
        onConfirm={async () => {
          try {
            await cancelSignature(tenant.id);
          } catch (e) {
            setError(errorMessage(e));
          }
          setCancelling(false);
        }}
      />
    </Card>
  );
}
