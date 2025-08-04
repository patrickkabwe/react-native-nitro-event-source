#pragma once
#include <vector>
#include "HybridNitroEventSourceSpec.hpp"

namespace margelo::nitro::nitroeventsource {
class HybridNitroEventSource : public HybridNitroEventSourceSpec {
    public:
        HybridNitroEventSource() : HybridObject(TAG), HybridNitroEventSourceSpec() {}
       
        double sum(double a, double b) override;
    };
} // namespace margelo::nitro::nitroeventsource
