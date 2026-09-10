import { Redirect } from "expo-router";
import { useConnection } from "../state/connection";

export default function Index() {
  const { status } = useConnection();
  if (status === "paired") return <Redirect href="/(tabs)" />;
  if (status === "unpaired") return <Redirect href="/pair" />;
  return null;
}
