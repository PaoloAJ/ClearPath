package profiles

import "testing"

func TestParse(t *testing.T) {
	for _, s := range []string{"wheelchair", "walking_aid", "bike", "scooter", "skateboard", "walking"} {
		if _, err := Parse(s); err != nil {
			t.Errorf("Parse(%q) = %v", s, err)
		}
	}
	if _, err := Parse("car"); err == nil {
		t.Error("Parse(\"car\") should fail")
	}
}

// TODO(routing): table-driven tests per mode: wheelchair never takes stairs or slope > 8%,
// riders never take indoor or bike_ok=false edges, AllowStairs relaxes exclusions.
