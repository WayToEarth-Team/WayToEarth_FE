import { useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { registerUser } from "@utils/api/users";
import type { UserInfo } from "@types/types";

export default function useRegister() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (userInfo: UserInfo) => {
    if (loading) return;
    setLoading(true);
    try {
      await registerUser(userInfo);
      Alert.alert("성공", "회원가입이 완료되었습니다!");
      // @ts-ignore
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "LiveRunningScreen" } }],
      });
    } catch (err: any) {
      Alert.alert(
        "실패",
        err?.response?.data?.message ||
          err?.message ||
          "회원가입에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return { handleRegister, loading };
}
