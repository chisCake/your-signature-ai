import { NextRequest, NextResponse } from "next/server";
import { getUser, isMod, canEditSignature } from "@/lib/auth-server-utils";
import { deleteSignature, getGenuineSignature, updateModForDataset, updateModForForgery, updateUserForForgery } from "@/lib/supabase/queries";
import { isSignatureBelongsToProfile } from "@/lib/types";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: signatureId } = await params;
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!await canEditSignature(null, signatureId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const success = await deleteSignature(signatureId);
  if (!success) {
    return NextResponse.json({ error: "Database delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: signatureId } = await params;
  const json = await req.json();

  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signature = await getGenuineSignature(signatureId);
  if (!signature) {
    return NextResponse.json({ error: "Signature not found" }, { status: 404 });
  }

  const userForForgery = json.userForForgery ?? null;
  const modForForgery = json.modForForgery ?? null;
  const modForDataset = json.modForDataset ?? null;
  
  if (userForForgery === null && modForForgery === null && modForDataset === null) {
    return NextResponse.json({ error: "No fields to update provided" }, { status: 400 });
  }

  if (userForForgery !== null) {
    const success = await updateModForForgery(signatureId, userForForgery);
    if (!success) {
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (isSignatureBelongsToProfile(signature) && !await canEditSignature(signature)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if ((modForForgery || modForDataset) && !await isMod(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (modForForgery !== null) {
    const success = await updateModForForgery(signatureId, modForForgery);
    if (!success) {
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (modForDataset !== null) {
    const success = await updateModForDataset(signatureId, modForDataset);
    if (!success) {
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}