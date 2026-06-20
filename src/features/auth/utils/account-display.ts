import type { User } from "@supabase/supabase-js";

type AccountDisplay = {
  fullName: string;
  email: string;
  phone: string;
  initials: string;
};

function getMetadataValue(user: User | null, key: string) {
  const value = user?.user_metadata?.[key];

  return typeof value === "string" ? value.trim() : "";
}

function getEmailPrefix(email: string) {
  return email.split("@")[0]?.trim() ?? "";
}

function getInitials(fullName: string, email: string) {
  const nameParts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (nameParts.length > 0 && fullName !== "MEDCO User") {
    return nameParts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  const firstEmailCharacter = email[0];

  return firstEmailCharacter ? firstEmailCharacter.toUpperCase() : "M";
}

export function getAccountDisplay(user: User | null): AccountDisplay {
  const realEmail = user?.email?.trim() ?? "";
  const metadataFullName = getMetadataValue(user, "full_name");
  const emailPrefix = realEmail ? getEmailPrefix(realEmail) : "";
  const fullName = metadataFullName || emailPrefix || "MEDCO User";
  const email = realEmail || "No email available";
  const phone = getMetadataValue(user, "phone") || "No phone available";

  return {
    fullName,
    email,
    phone,
    initials: getInitials(fullName, realEmail),
  };
}
