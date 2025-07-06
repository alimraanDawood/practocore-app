<template>
  <LayoutAuth>
    <div class="flex flex-col w-full overflow-hidden items-center justify-center h-[100dvh]">
      <div class="flex flex-col gap-3 p-3 w-full h-full lg:max-w-sm lg:h-fit lg:gap-5">
        <div class="flex flex-col gap-2">
          <div class="flex flex-row justify-between items-center">
            <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Horizontal.svg" class="h-12"/>

            <div class="flex flex-row gap-2">
              <Button size="icon" variant="secondary">
                <ArrowLeft/>
              </Button>

              <Button size="icon" variant="secondary">
                <ArrowRight/>
              </Button>
            </div>
          </div>
        </div>
        <div class="flex flex-col h-full w-full">
          <XyzTransition mode="out-in" xyz="fade in-right out-left">
            <AccountType v-if="currentStep === RegistrationSteps.ACC_TYPE" @complete="accountTypeRegistComplete" />
            <OrganisationRegister v-else-if="currentStep === RegistrationSteps.ORG_REGIST" @complete="organisationRegistComplete" />
            <FirmDetailsRegister v-else-if="currentStep === RegistrationSteps.FIRM_DETAILS_REGIST" @complete="firmDetailsRegistComplete" />
            <PrimaryContactRegister v-else-if="currentStep === RegistrationSteps.PRIMARY_CONTACT_REGIST" @complete="primaryContactRegistComplete" />
            <AdminRegister v-else-if="currentStep === RegistrationSteps.ADMIN_REGIST" @complete="adminRegistComplete" />
            <CreatingAccount v-else-if="currentStep === RegistrationSteps.CREATING" />
            <OTP :otp-id="otpId" :user-id="userId" v-else-if="currentStep === RegistrationSteps.OTP" />
          </XyzTransition>
        </div>

        <div class="flex flex-row text-sm text-center w-full justify-center text-muted-foreground">
            <span>
              Already have an account?
              <NuxtLink to="login" class="text-primary font-semibold underline">Login Instead</NuxtLink>.
            </span>
        </div>
      </div>
    </div>
  </LayoutAuth>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import AccountType from "~/components/auth/RegisterScreens/AccountType.vue";
import OrganisationRegister from "~/components/auth/RegisterScreens/OrganisationRegister.vue";
import PrimaryContactRegister from "~/components/auth/RegisterScreens/PrimaryContactRegister.vue";
import FirmDetailsRegister from "~/components/auth/RegisterScreens/FirmDetailsRegister.vue";
import AdminRegister from "~/components/auth/RegisterScreens/AdminRegister.vue";
import CreatingAccount from "~/components/auth/RegisterScreens/CreatingAccount.vue";
import OTP from '~/components/auth/RegisterScreens/OTP.vue';

import { submitAccountDetails } from "~/services/auth";
enum RegistrationSteps {
  ACC_TYPE = 1,
  ORG_REGIST = 2,
  PRIMARY_CONTACT_REGIST = 3,
  FIRM_DETAILS_REGIST = 4,
  ADMIN_REGIST = 5,
  CREATING = 6,
  OTP = 7
}

const currentStep = ref(RegistrationSteps.ACC_TYPE);

const registrationData = {
  type: 'IND',
  organisation: {},
  user: {}
}

const userId = ref('');
const otpId = ref('');

definePageMeta({
  layout: 'blank',
});

const accountTypeRegistComplete = (val) => {
  if(val === 'ORG') {
    registrationData.type = 'ORG';
    currentStep.value = RegistrationSteps.ORG_REGIST;
  } else if (val === 'IND') {
    registrationData.type = 'IND';
    currentStep.value = RegistrationSteps.PRIMARY_CONTACT_REGIST;
  }
}

const organisationRegistComplete = (val) => {
  registrationData.organisation = val;
  currentStep.value = RegistrationSteps.FIRM_DETAILS_REGIST;
}

const firmDetailsRegistComplete = (val) => {
  registrationData.organisation = {...registrationData.organisation, ...val};

  currentStep.value = RegistrationSteps.PRIMARY_CONTACT_REGIST;
}

const primaryContactRegistComplete = (val) => {
  registrationData.organisation = {...registrationData.organisation,
    contact: val
  }

  currentStep.value = RegistrationSteps.ADMIN_REGIST;
}

const adminRegistComplete = (val) => {
  registrationData.user = val;

  currentStep.value = RegistrationSteps.CREATING;
  submitData();
}

const submitData = async () => {
  try {
    const result = await submitAccountDetails(registrationData);

    if(result) {
      console.log(result);
      otpId.value = result.otpId;
      userId.value = result.userId;
    }

    currentStep.value = RegistrationSteps.OTP;
  } catch(e) {
    console.error(e);
  }
}

</script>

<style scoped>

</style>
