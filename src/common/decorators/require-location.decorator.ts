import { SetMetadata } from '@nestjs/common';

export const REQUIRE_LOCATION_KEY = 'requireLocation';

export const RequireLocation = () => SetMetadata(REQUIRE_LOCATION_KEY, true);
